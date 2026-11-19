import React, { useEffect, useRef } from 'react';
import { TrashGlyph } from '@/ui/TrashGlyph';
import { animate } from 'framer-motion';
import { SPRING } from '@/ui/springPose';
import { decideSwipe, velocityOf } from '@/ui/swipeDecision';

/**
 * Moves a number from `from` to `to` on the system's own spring (the one every other motion in Haus uses), carrying `velocity`
 * (units per second) into it — so a row let go while moving keeps moving a little, then settles, rather than easing along a
 * fixed curve. Resolves false if stopped. Where the browser can't animate (or motion is reduced) it jumps there at once.
 */
function spring(
  from: number, to: number, velocity: number, onUpdate: (value: number) => void,
  extra: { stiffness?: number; damping?: number; restDelta?: number; restSpeed?: number } = {},
): { done: Promise<boolean>; stop: () => void } {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function' || reduced) {
    onUpdate(to);
    return { done: Promise.resolve(true), stop: () => {} };
  }
  let settle: (finished: boolean) => void = () => {};
  const done = new Promise<boolean>((resolve) => { settle = resolve; });
  const controls = animate(from, to, {
    type: 'spring', stiffness: SPRING.stiffness, damping: SPRING.damping, mass: SPRING.mass, velocity, restDelta: 0.5, restSpeed: 20, ...extra,
    onUpdate, onComplete: () => settle(true),
  });
  return { done, stop: () => { controls.stop(); settle(false); } };
}

/**
 * The trackpad's sideways stream, seen once for the whole page. A swipe is one stream of wheel steps (a pause of 150 ms starts a
 * new one), and it belongs to the row it began over. That is what keeps a swipe's momentum from going on to the row that slides
 * up into the place of one just deleted — which would delete that one too — or from starting a second swipe on the same row.
 */
const stream = { id: 0, last: 0, origin: null as Element | null, owner: null as Element | null };
if (typeof document !== 'undefined') {
  document.addEventListener('wheel', (e) => {
    const now = performance.now();
    if (stream.origin === null || now < stream.last || now - stream.last > 150) { stream.id += 1; stream.origin = e.target as Element | null; stream.owner = null; }
    stream.last = now;
  }, { capture: true, passive: true });
}

/** How long with no step at all before the fingers are taken to have stopped and the swipe is decided. */
const STOPPED_MS = 220;

/**
 * Swipe a row to the left to delete it. A red "Delete" is uncovered behind the row as it follows the hand; let go past the
 * halfway mark (or flick it) and the row slides out and `onDelete` runs; let go before that and it eases back.
 *
 * Two ways in, both on the row itself:
 *  - the trackpad: a two-finger swipe sideways. It moves the row 1:1 with the fingers and is decided where they stop — the
 *    momentum the Mac adds after the fingers lift is not counted, so the row lets go where the hand did. It works anywhere,
 *    so a board card can use it too.
 *  - pressing and dragging sideways with the mouse or a finger (`drag`). Off for the board's cards, where a sideways drag
 *    already means "move this to another column".
 * Controls inside the row (the tick, a status picker) and text fields are left alone, and a swipe never counts as a click.
 * Grabbing a row that is still easing back picks it up where it is.
 *
 * It moves the row with a transform written straight to its style each frame — no React render per frame — and clips only
 * while it is moving, so popovers and tooltips on the row still show at rest.
 */
export const SwipeRow: React.FC<{
  onDelete: () => void;
  enabled?: boolean;
  /** Also swipe by pressing and dragging (mouse, touch). */
  drag?: boolean;
  /** The row's corner radius class, so the red layer behind it matches. */
  radius?: string;
  /** What the row is drawn on while it slides, so the red behind it doesn't show through a see-through row. */
  surface?: string;
  /** Close the gap the row leaves by shrinking its height (a row in a list). Off for something that goes away whole, like a dialog. */
  collapse?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ onDelete, enabled = true, drag = true, radius = 'rounded-box', collapse = true, surface = 'bg-paper-dark', className = '', children }) => {
  const root = useRef<HTMLDivElement>(null);
  const slide = useRef<HTMLDivElement>(null);
  const reveal = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLSpanElement>(null);
  const word = useRef<HTMLSpanElement>(null);
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;

  useEffect(() => {
    const el = root.current, slideEl = slide.current, rev = reveal.current, glyph = mark.current, label = word.current;
    if (!el || !slideEl || !rev || !glyph || !label || !enabled) return;

    type Phase = 'idle' | 'tracking' | 'back' | 'leaving';
    const s = {
      phase: 'idle' as Phase,
      source: null as 'wheel' | 'pointer' | null,
      pull: 0,                       // how far it has been pulled left, in px (>= 0)
      shown: 0,                      // how far it is drawn to the left right now (the pull, less the resistance; or where a spring has got to)
      anim: null as null | { stop: () => void },
      idle: 0,
      quietUntil: 0,                 // a swipe just ended: the momentum still arriving is not a new one
      pre: { x: 0, y: 0, t: 0 },     // sideways movement seen before a trackpad swipe is recognised, so none of it is lost
      deltas: [] as number[],        // the latest wheel steps, to tell the fingers from their momentum
      steps: [] as Array<[number, number]>,   // (time, step) of the hand's recent movement, for its speed
      peak: 0,
      down: null as null | { id: number; x: number; y: number; last: number; lastT: number; v: number; prev: number },
      swallow: false,
      spent: 0,                      // the stream (see above) this row has already decided on: its tail is not a new swipe
    };
    const threshold = () => Math.max(1, Math.min(el.offsetWidth * 0.5, 200));
    /** Where the row is drawn for a pull: past the halfway mark it resists, so the release point can be felt. */
    const shownFor = (pull: number) => { const t = threshold(); return pull <= t ? pull : t + (pull - t) * 0.35; };
    /** The pull that is drawn as `shown` (the other way round), to pick a row up where it is. */
    const pullFor = (shown: number) => { const t = threshold(); return shown <= t ? shown : t + (shown - t) / 0.35; };

    /** Draws the row `shown` px to the left, and the red behind it to match. */
    const paintShown = (shown: number) => {
      s.shown = shown;
      const t = threshold();
      slideEl.style.transform = `translate3d(${-Math.max(-10, shown)}px, 0, 0)`;
      rev.style.opacity = String(Math.min(1, Math.max(0, shown / 28)));
      const ready = shown >= t;
      const lift = Math.min(1, Math.max(0, shown / t));
      glyph.style.transform = `scale(${ready ? 1.12 : 0.75 + 0.25 * lift})`;
      glyph.style.setProperty('--lift', String(lift * lift));
      if (ready) glyph.setAttribute('data-ready', ''); else glyph.removeAttribute('data-ready');
      const text = ready ? 'Release' : 'Delete';
      if (label.textContent !== text) label.textContent = text;
    };
    const paint = () => paintShown(shownFor(s.pull));

    const rest = () => {
      s.phase = 'idle';
      s.source = null;
      s.pull = 0;
      s.shown = 0;
      s.anim = null;
      slideEl.style.transform = '';
      slideEl.style.willChange = '';
      rev.style.display = 'none';
      rev.style.opacity = '0';
      el.style.overflow = '';
      el.style.height = '';
      el.style.opacity = '';
      label.textContent = 'Delete';
    };

    /** Takes hold of the row — from rest, or from wherever it is while it springs back. */
    const grab = (source: 'wheel' | 'pointer') => {
      if (s.phase === 'back') {
        s.anim?.stop();
        s.pull = Math.max(0, pullFor(s.shown));
        s.anim = null;
      }
      s.phase = 'tracking';
      s.source = source;
      s.steps = [];
      rev.style.display = 'flex';
      el.style.overflow = 'hidden';
      slideEl.style.willChange = 'transform';
      paint();
    };

    /** Springs back to rest, carrying on a little in the direction the hand was going (`velocity`, px/ms leftward). */
    const back = (velocity: number) => {
      s.phase = 'back';
      const run = spring(s.shown, 0, velocity * 1000, paintShown);
      s.anim = run;
      void run.done.then((finished) => { if (finished && s.phase === 'back') rest(); });
    };

    /** Throws the row off to the left on the spring, then folds up the space it leaves, then reports the delete. */
    const leave = (velocity: number) => {
      s.phase = 'leaving';
      const width = el.offsetWidth, height = el.offsetHeight;
      const toss = spring(s.shown, width + 24, Math.max(velocity * 1000, 900), paintShown, { stiffness: 260, damping: 30, restDelta: 4, restSpeed: 80 });
      s.anim = toss;
      void (async () => {
        await toss.done;
        // The gap it leaves closes up, instead of the list jumping when the row is removed.
        if (collapse) {
          el.style.height = `${height}px`;
          await spring(height, 0, 0, (h) => { el.style.height = `${Math.max(0, h)}px`; el.style.opacity = String(Math.min(1, Math.max(0, h / height))); }, { stiffness: 320, damping: 36, restDelta: 1, restSpeed: 40 }).done;
        }
        onDeleteRef.current();
        // If nothing took the row away (the delete was refused), it must not stay folded up and invisible.
        window.setTimeout(() => { if (el.isConnected && s.phase === 'leaving') rest(); }, 800);
      })();
    };

    /** Lets go: decides between deleting and easing back. `velocity` is px/ms to the left. */
    const settle = (velocity: number) => {
      if (s.phase !== 'tracking') return;
      window.clearTimeout(s.idle);
      s.quietUntil = performance.now() + 140;
      s.spent = stream.id;
      s.deltas = [];
      s.steps = [];
      s.peak = 0;
      if (decideSwipe({ pull: s.pull, threshold: threshold(), velocity }) === 'delete') leave(velocity); else back(velocity);
    };
    /** How fast the hand was going (px/ms, leftward positive) over the moments up to `at`. */
    const handSpeed = (at: number = performance.now()) => velocityOf(s.steps, at);
    /** The speed as of the last step that arrived: when the stream simply stops, that is how fast the hand was when it stopped. */
    const speedAtLastStep = () => handSpeed(s.steps.length ? s.steps[s.steps.length - 1][0] : performance.now());

    // ── Trackpad ──
    /** The fingers have lifted and the Mac is coasting: steps that only ever shrink, well under the strongest. */
    const coasting = () => {
      const d = s.deltas;
      if (d.length < 4) return false;
      const [a, b, c, e] = d.slice(-4);
      // Momentum dies away step by step, and strictly; a hand dragging along steadily doesn't (equal or uneven steps).
      return a > b && b > c && c > e && e > 0 && e <= s.peak * 0.5;
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || s.phase === 'leaving') { if (s.phase === 'leaving' && Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.preventDefault(); return; }
      const now = performance.now();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;     // lines or pages, on a mouse, rather than pixels
      const dx = e.deltaX * unit, dy = e.deltaY * unit;
      const horizontal = Math.abs(dx) > Math.abs(dy);
      // With natural scrolling (the default) fingers moving left give a positive deltaX; without it, a negative one.
      const left = (e as WheelEvent & { webkitDirectionInvertedFromDevice?: boolean }).webkitDirectionInvertedFromDevice === false ? -dx : dx;

      if (s.phase !== 'tracking') {
        // Momentum left over from the last swipe keeps arriving for a while: it is neither a new swipe nor to be let through.
        if (now < s.quietUntil) { s.quietUntil = now + 120; if (horizontal) e.preventDefault(); return; }
        if ((e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
        // Only a stream that began over this row, and that nothing else has taken, can be a swipe of it.
        if (!stream.origin || !el.contains(stream.origin) || (stream.owner !== null && stream.owner !== el) || s.spent === stream.id) return;
        // A swipe is recognised from its first few steps together, not from one of them: they are small and a little crooked.
        if (now - s.pre.t > 150) s.pre = { x: 0, y: 0, t: now };
        s.pre = { x: s.pre.x + left, y: s.pre.y + dy, t: now };
        // Nothing is held back until the swipe is recognised as one for this row: until then it is the browser's (a swipe to
        // the right still goes back a page, and so does anything that isn't clearly this row's). From then on it is the row's.
        if (!(s.pre.x >= 5 && s.pre.x >= Math.abs(s.pre.y) * 1.15)) return;
        grab('wheel');
        stream.owner = el;
        s.pull += s.pre.x;
        s.steps = [[now, s.pre.x]];
        s.pre = { x: 0, y: 0, t: 0 };
        s.deltas = [];
        s.peak = 0;
        e.preventDefault();
        paint();
        window.clearTimeout(s.idle);
        s.idle = window.setTimeout(() => settle(speedAtLastStep()), STOPPED_MS);
        return;
      }
      if (s.source !== 'wheel') return;
      // Holds the page back from taking the sideways swipe as "go back".
      e.preventDefault();
      s.deltas.push(Math.max(0, left));
      if (s.deltas.length > 6) s.deltas.shift();
      s.peak = Math.max(s.peak, left);
      if (coasting()) { settle(handSpeed()); return; }       // the fingers are up: decide here, don't ride the momentum
      s.pull = Math.max(0, s.pull + left);
      s.steps.push([now, left]);
      if (s.steps.length > 12) s.steps.shift();
      paint();
      window.clearTimeout(s.idle);
      s.idle = window.setTimeout(() => settle(speedAtLastStep()), STOPPED_MS);
    };

    // ── Press and drag ──
    const stopTracking = () => {
      s.down = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    const onMove = (e: PointerEvent) => {
      const d = s.down;
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      const now = performance.now();
      if (s.phase !== 'tracking') {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { stopTracking(); return; }
        if (dx > -10 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
        grab('pointer');
        try { el.setPointerCapture(e.pointerId); } catch { /* a pointer that has gone */ }
        el.style.userSelect = 'none';
      }
      if (s.source !== 'pointer') return;
      s.pull = Math.max(0, -dx - 10);
      const dt = now - d.lastT;
      if (dt > 0) d.v = 0.8 * d.v + 0.2 * ((d.last - e.clientX) / dt);
      d.last = e.clientX; d.lastT = now;
      s.steps.push([now, d.prev - e.clientX]);
      if (s.steps.length > 12) s.steps.shift();
      d.prev = e.clientX;
      paint();
    };
    const onUp = (e: PointerEvent) => {
      const d = s.down;
      if (!d || e.pointerId !== d.id) return;
      const was = s.phase === 'tracking' && s.source === 'pointer';
      const v = handSpeed();
      stopTracking();
      el.style.userSelect = '';
      try { el.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      if (was) {
        s.swallow = true;
        window.setTimeout(() => { s.swallow = false; }, 120);
        settle(v);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!drag || s.phase === 'leaving' || s.phase === 'tracking' || e.button !== 0) return;
      if ((e.target as Element | null)?.closest?.('button, a, input, textarea, select, [data-no-swipe]')) return;
      s.down = { id: e.pointerId, x: e.clientX, y: e.clientY, last: e.clientX, lastT: performance.now(), v: 0, prev: e.clientX };
      // Grabbing a row that is still easing back stops it where it is.
      if (s.phase === 'back') { grab('pointer'); s.down.x += s.pull + 10; }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    };
    // The click that ends a swipe is not a click on the row.
    const onClickCapture = (e: MouseEvent) => { if (s.swallow) { e.preventDefault(); e.stopPropagation(); s.swallow = false; } };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('click', onClickCapture, true);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('click', onClickCapture, true);
      stopTracking();
      window.clearTimeout(s.idle);
      s.anim?.stop();
      if (s.phase !== 'leaving') rest();
    };
  }, [enabled, drag, collapse]);

  return (
    <div ref={root} className={`relative ${className}`} style={{ touchAction: enabled && drag ? 'pan-y' : undefined }}>
      {enabled && (
        <div ref={reveal} aria-hidden className={`absolute inset-0 ${radius} bg-rust text-white items-center justify-end pr-5`} style={{ display: 'none', opacity: 0 }}>
          <span ref={mark} className="flex items-center gap-2 font-mono-main text-[11px] font-bold uppercase tracking-widest" style={{ transformOrigin: 'right center', transition: 'transform 160ms cubic-bezier(0.23, 1, 0.32, 1)' }}>
            <TrashGlyph size={20} /> <span ref={word}>Delete</span>
          </span>
        </div>
      )}
      <div ref={slide} className={`relative ${radius} ${surface}`}>{children}</div>
    </div>
  );
};
