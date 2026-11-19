import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useDismiss } from '@/ui/useDismiss';
import { IconChevronRight as ChevronRight } from '@/ui/icons';

/** What a context menu can hold. */
export type MenuItem =
  | { kind: 'item'; label: string; hint?: string; onSelect: () => void; danger?: boolean; disabled?: boolean }
  /** A line that opens a list to pick one from (a status, a priority); `value` is what is picked now, shown on the line. */
  | { kind: 'submenu'; label: string; value?: string; options: ReadonlyArray<{ value: string; label: string; active?: boolean }>; onPick: (value: string) => void; disabled?: boolean }
  | { kind: 'separator' };

const MARGIN = 8;
const WIDTH = 264;

/** The lines look and measure like the dropdowns' (see FilterSelect), so every list in the system reads the same. */
const ROW = 'w-full flex items-center justify-between gap-6 text-left px-3.5 py-2.5 whitespace-nowrap font-mono-main text-[12px] uppercase tracking-[0.2em] font-bold transition-colors outline-none cursor-pointer disabled:opacity-35 disabled:cursor-default';
const PANEL = 'bg-paper-dark border border-ink/14 rounded-box shadow-[0_16px_40px_rgba(0,0,0,0.2)]';

type Placed = { left: number; top: number; originX: number; originY: number; w: number; h: number };

/**
 * The menu a right click opens, in the system's own dress: lines like a dropdown's, a short list of choices opening beside the
 * line (Status ›, Priority ›), and a quick spring — it drops out of the spot that was clicked, settles in about a fifth of a second, and leaves quicker. It closes
 * on a click elsewhere, Escape, scrolling, or choosing something. Up/Down move between the lines, Right opens a list, Left
 * closes it, Enter chooses. `at` is where it was opened; null keeps it closed.
 */
export const ContextMenu: React.FC<{
  at: { x: number; y: number } | null;
  items: readonly MenuItem[];
  onClose: () => void;
}> = ({ at, items, onClose }) => {
  // The real menu and list, and — separate refs, on purpose — the copies laid out out of sight to be measured. One ref on both a
  // leaving and an arriving element ends up null when the old one unmounts, and the menu then takes a click on itself for a click outside.
  const root = useRef<HTMLDivElement>(null);
  const flyout = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const measureFly = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Placed | null>(null);
  const [sub, setSub] = useState<{ index: number; top: number } | null>(null);
  const [subPlace, setSubPlace] = useState<{ left: number; top: number; w: number; h: number } | null>(null);
  useDismiss(at !== null, onClose, [root, flyout]);

  /** Opens (or moves) the list beside a line. A different line has a different list, which is measured afresh. */
  const showSub = (index: number, top: number) => {
    if (sub?.index !== index) setSubPlace(null);
    setSub({ index, top });
  };

  // Placed once it has a size: from the pointer, flipped to the other side where it would run off the window.
  useLayoutEffect(() => {
    if (!at) { setPlace(null); setSub(null); return; }
    const box = measure.current;
    if (!box) return;
    const { offsetWidth: w, offsetHeight: h } = box;
    const left = at.x + w + MARGIN > window.innerWidth ? Math.max(MARGIN, at.x - w) : at.x;
    const top = at.y + h + MARGIN > window.innerHeight ? Math.max(MARGIN, at.y - h) : at.y;
    setPlace({ left, top, originX: at.x - left, originY: at.y - top, w, h });
  }, [at, items.length]);

  // The list beside a line: to the right of the menu, or to its left where there is no room, and kept inside the window.
  useLayoutEffect(() => {
    if (!sub || !place) { setSubPlace(null); return; }
    const panel = measureFly.current;
    if (!panel) return;
    const w = panel.offsetWidth, h = panel.offsetHeight;
    const right = place.left + place.w + 4;
    const left = right + w + MARGIN > window.innerWidth ? Math.max(MARGIN, place.left - w - 4) : right;
    setSubPlace({ left, top: Math.max(MARGIN, Math.min(sub.top, window.innerHeight - h - MARGIN)), w, h });
  }, [sub, place]);

  useEffect(() => {
    if (!at) return;
    const close = () => onClose();
    // Anything that moves the page under it, or another right click, ends it.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    document.addEventListener('contextmenu', close, true);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
      document.removeEventListener('contextmenu', close, true);
    };
  }, [at, onClose]);

  const lines = () => Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[data-line]:not(:disabled)') ?? []);
  const onKeyDown = (e: React.KeyboardEvent) => {
    const inFlyout = flyout.current?.contains(document.activeElement);
    if (e.key === 'ArrowLeft' && inFlyout) {
      e.preventDefault();
      const index = sub?.index;
      setSub(null);
      requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`[data-line="${index}"]`)?.focus());
      return;
    }
    if (e.key === 'ArrowRight' && !inFlyout) {
      const active = document.activeElement as HTMLElement | null;
      const index = active?.dataset.line !== undefined ? Number(active.dataset.line) : -1;
      if (index >= 0 && items[index]?.kind === 'submenu') {
        e.preventDefault();
        showSub(index, active!.getBoundingClientRect().top);
        requestAnimationFrame(() => flyout.current?.querySelector<HTMLButtonElement>('button')?.focus());
      }
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const all = inFlyout ? Array.from(flyout.current!.querySelectorAll<HTMLButtonElement>('button')) : lines();
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    const next = i === -1 ? (e.key === 'ArrowDown' ? 0 : all.length - 1) : e.key === 'ArrowDown' ? (i + 1) % all.length : (i - 1 + all.length) % all.length;
    all[next]?.focus();
  };

  const open = sub ? items[sub.index] : null;

  // Quick to open, and physical in how it moves: it drops out of the spot that was clicked on a stiff spring — stiff enough to be done
  // in about a fifth of a second, soft enough to overshoot a hair and settle — so it has weight without making anyone wait.
  const MENU_SPRING = { type: 'spring', stiffness: 640, damping: 31, mass: 0.8, opacity: { duration: 0.08 } } as const;

  const rows = items.map((item, i) => {
    if (item.kind === 'separator') return <div key={i} className="h-px bg-ink/10" />;
    if (item.kind === 'submenu') {
      return (
        <button
          key={i}
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={sub?.index === i}
          data-line={i}
          disabled={item.disabled}
          onMouseEnter={(e) => { if (!item.disabled) showSub(i, e.currentTarget.getBoundingClientRect().top); }}
          onClick={(e) => showSub(i, e.currentTarget.getBoundingClientRect().top)}
          className={`${ROW} ${sub?.index === i ? 'bg-ink/5 text-ink' : 'text-ink/70 hover:bg-ink/5 hover:text-ink focus-visible:bg-ink/5'}`}
        >
          <span>{item.label}</span>
          <span className="flex items-center gap-2 text-ink/40 font-medium">
            {item.value}
            <ChevronRight size={12} />
          </span>
        </button>
      );
    }
    return (
      <button
        key={i}
        type="button"
        role="menuitem"
        data-line={i}
        disabled={item.disabled}
        onMouseEnter={() => setSub(null)}
        onClick={() => { item.onSelect(); onClose(); }}
        className={`${ROW} ${item.danger ? 'text-rust hover:bg-rust/10 focus-visible:bg-rust/10' : 'text-ink/70 hover:bg-ink/5 hover:text-ink focus-visible:bg-ink/5'}`}
      >
        <span>{item.label}</span>
        {item.hint && <span className="text-ink/35 font-medium normal-case tracking-normal">{item.hint}</span>}
      </button>
    );
  });

  return createPortal(
    <>
      {at && !place && (
        // Laid out out of sight first, to know its size and where it fits; then the real one drops in.
        <div ref={measure} aria-hidden style={{ position: 'fixed', width: WIDTH, left: at.x, top: at.y, visibility: 'hidden', pointerEvents: 'none' }} className={PANEL}>
          <div className="overflow-hidden rounded-box">{rows}</div>
        </div>
      )}
      {at && place && open && open.kind === 'submenu' && !subPlace && (
        <div ref={measureFly} aria-hidden style={{ position: 'fixed', minWidth: 200, left: -9999, top: 0, visibility: 'hidden', pointerEvents: 'none' }} className={PANEL}>
          <div className="overflow-hidden rounded-box">
            {open.options.map((o) => <div key={o.value} className={`${ROW} text-ink/60`}><span>{o.active ? '● ' : '○ '}{o.label}</span></div>)}
          </div>
        </div>
      )}
    <AnimatePresence>
      {at && place && (
        <motion.div
          key="menu"
          ref={root}
          role="menu"
          tabIndex={-1}
          onKeyDown={onKeyDown}
          onContextMenu={(e) => e.preventDefault()}
          initial={{ opacity: 0, scale: 0.86, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1, ease: [0.23, 1, 0.32, 1] } }}
          transition={MENU_SPRING}
          style={{ position: 'fixed', width: WIDTH, left: place.left, top: place.top, transformOrigin: `${place.originX}px ${place.originY}px` }}
          className={`z-[10002] ${PANEL}`}
        >
          <div className="overflow-hidden rounded-box">{rows}</div>
        </motion.div>
      )}
      {at && open && open.kind === 'submenu' && subPlace && (
        <motion.div
          key={`sub-${sub!.index}`}
          ref={flyout}
          role="menu"
          onKeyDown={onKeyDown}
          onContextMenu={(e) => e.preventDefault()}
          // The list slides out from the line it belongs to, from its left edge.
          initial={{ opacity: 0, scale: 0.92, x: -10 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
          transition={MENU_SPRING}
          style={{ position: 'fixed', minWidth: 200, left: subPlace.left, top: subPlace.top, transformOrigin: 'left top' }}
          className={`z-[10003] ${PANEL}`}
        >
          <div className="overflow-hidden rounded-box">
            {open.options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="menuitemradio"
                aria-checked={!!o.active}
                disabled={open.disabled}
                onClick={() => { open.onPick(o.value); onClose(); }}
                className={`${ROW} ${o.active ? 'text-ink' : 'text-ink/60'} hover:bg-ink/5 hover:text-ink focus-visible:bg-ink/5`}
              >
                <span>{o.active ? '● ' : '○ '}{o.label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>,
    document.body,
  );
};
