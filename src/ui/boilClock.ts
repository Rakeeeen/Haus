/**
 * The one clock behind every hand-drawn icon's "line boil" (ui/Sketch.tsx → Boil). Each icon is drawn three times, and one of
 * the three shows at a time. That used to be a CSS animation on every redraw of every icon — dozens of animations, each one
 * restyling and repainting on the main thread four times a second, and every icon off its own beat.
 *
 * Now there is one timer, and what it does is set three attributes on <html> (`data-boil-a`, `-b`, `-c`: which of the three
 * redraws shows, at three speeds). The CSS (global.css, "Hand-drawn icons") shows the matching redraw of every icon at once: one
 * style recalculation and one repaint per tick, whatever the number of icons on the page.
 *
 * The clock runs only while an icon that is moving is mounted and the tab is visible. With no clock (reduced motion, a hidden
 * tab, a paused icon) the attributes are absent and every icon shows its first drawing, still — never an empty space.
 */

const FRAMES = 3;
/** One tick: four a second, as the boil always was. The slower speeds (b: half, c: a quarter) change on every 2nd / 4th tick. */
export const BOIL_TICK_MS = 250;
const SPEEDS = [['a', 1], ['b', 2], ['c', 4]] as const;

/** Which of the three speeds an icon whose three redraws take `cycleSeconds` to go round belongs to. */
export function boilSpeed(cycleSeconds: number): 'a' | 'b' | 'c' {
  return cycleSeconds <= 1 ? 'a' : cycleSeconds <= 2 ? 'b' : 'c';
}

let users = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let ticks = 0;
let listening = false;

const root = () => document.documentElement;
const wantsStill = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function show(ticksSoFar: number) {
  for (const [name, every] of SPEEDS) {
    const attr = `data-boil-${name}`;
    const frame = String(Math.floor(ticksSoFar / every) % FRAMES);
    if (root().getAttribute(attr) !== frame) root().setAttribute(attr, frame);
  }
}

function sync() {
  const run = users > 0 && !document.hidden && !wantsStill();
  if (run && !timer) {
    ticks = 0;
    show(ticks);
    timer = setInterval(() => show(++ticks), BOIL_TICK_MS);
  } else if (!run && timer) {
    clearInterval(timer);
    timer = null;
    SPEEDS.forEach(([name]) => root().removeAttribute(`data-boil-${name}`));
  }
}

/** An icon that is moving calls this while it is on screen; the returned function says it has gone. */
export function joinBoil(): () => void {
  users += 1;
  if (!listening) { listening = true; document.addEventListener('visibilitychange', sync); }
  sync();
  return () => { users -= 1; sync(); };
}
