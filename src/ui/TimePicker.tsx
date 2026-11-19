import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDismiss } from '@/ui/useDismiss';
import { IconChevronDown as ChevronDown } from '@/ui/icons';
import { to12Hour } from '@/domain/clock';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const pad = (n: number) => String(n).padStart(2, '0');

const ROW = 'h-9';
const NO_SCROLLBAR = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/** One column of the panel: all three share the panel's width equally, and the long ones scroll six rows at a time. */
const Column: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div role="listbox" aria-label={label} className={`flex-1 min-w-0 flex flex-col gap-1 max-h-[236px] overflow-y-auto ${NO_SCROLLBAR}`}>{children}</div>
);

const Cell: React.FC<{ chosen: boolean; onClick: () => void; children: React.ReactNode }> = ({ chosen, onClick, children }) => (
  <button
    type="button"
    role="option"
    aria-selected={chosen}
    onClick={onClick}
    className={`${ROW} w-full shrink-0 rounded-full font-mono-main text-[13px] tabular-nums cursor-pointer transition-colors ${chosen ? 'bg-ink text-paper font-bold' : 'text-ink/70 hover:bg-ink/8 hover:text-ink'}`}
  >{children}</button>
);

/**
 * A time of day in 12-hour form: a button showing "9:00 AM" that opens a small panel (hour, minute, AM/PM) floating over the
 * page, like the date picker. The system's own time field follows the computer's 12/24-hour setting and can't be styled, so
 * this one is drawn here. The value is "HH:MM" in 24 hours, as the rest of the app stores it.
 */
export function TimePicker({ value, onChange, ariaLabel, className = '' }: {
  value: string;
  onChange: (hhmm: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ left: number; top: number; width: number } | null>(null);
  useDismiss(open, () => setOpen(false), [rootRef, panelRef]);

  const [h = 9, m = 0] = value.split(':').map(Number);
  const pm = h >= 12;
  const hour12 = h % 12 || 12;
  const set = (nextHour12: number, nextMinute: number, nextPm: boolean) =>
    onChange(`${pad((nextHour12 % 12) + (nextPm ? 12 : 0))}:${pad(nextMinute)}`);
  // A minute that isn't a multiple of five (an older reminder) stays in the list.
  const minutes = MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort((a, b) => a - b);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = rootRef.current?.getBoundingClientRect();
      if (!r) return;
      const height = panelRef.current?.offsetHeight ?? 250;
      const below = r.bottom + 6 + height <= window.innerHeight || r.top - 6 - height < 0;
      // As wide as the field it opens from, and lined up with it.
      setAt({ left: Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8)), top: below ? r.bottom + 6 : r.top - 6 - height, width: r.width });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);

  // The chosen hour and minute are brought into view when it opens.
  useLayoutEffect(() => {
    if (open) panelRef.current?.querySelectorAll('[aria-selected="true"]').forEach((el) => el.scrollIntoView({ block: 'center' }));
  }, [open, at !== null]);

  const panel = (
    <div
      ref={panelRef}
      style={{ position: 'fixed', left: at?.left ?? 0, top: at?.top ?? 0, width: at?.width, visibility: at ? 'visible' : 'hidden' }}
      className="z-[10000] bg-paper-dark border border-ink/14 rounded-box p-2 flex gap-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.18)]"
    >
      <Column label="Hour">{HOURS.map((n) => <Cell key={n} chosen={n === hour12} onClick={() => set(n, m, pm)}>{n}</Cell>)}</Column>
      <Column label="Minute">{minutes.map((n) => <Cell key={n} chosen={n === m} onClick={() => set(hour12, n, pm)}>{pad(n)}</Cell>)}</Column>
      <Column label="AM or PM">{(['AM', 'PM'] as const).map((p) => <Cell key={p} chosen={(p === 'PM') === pm} onClick={() => set(hour12, m, p === 'PM')}>{p}</Cell>)}</Column>
    </div>
  );

  return (
    <div ref={rootRef} className={`block ${className}`}>
      {/* Drawn like the text fields beside it (same height, fill, line, corners and type), so a row of them lines up. */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-[15px] text-left font-mono-main text-ink bg-ink/5 border rounded-box outline-none transition-colors cursor-pointer ${open ? 'border-ink' : 'border-ink/12 hover:border-ink/40 focus-visible:border-ink'}`}
      >
        <span>{to12Hour(value)}</span>
        <ChevronDown size={14} className={`text-ink/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && createPortal(panel, document.body)}
    </div>
  );
}
