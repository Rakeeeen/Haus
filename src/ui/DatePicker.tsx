import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/ui/Button';
import { useDismiss } from '@/ui/useDismiss';
import { IconChevronDown as ChevronDown, IconChevronRight as ChevronRight } from '@/ui/icons';
import { addDays, dayKey, monthGrid, parseDayKey } from '@/domain/work/tasks';

const WEEK = ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr'];
const label = (key: string | null, now: Date = new Date()) => {
  if (!key) return null;
  const date = parseDayKey(key);
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
};

/**
 * Picks a day from a small calendar that floats over the page (never pushing it), with Today and Tomorrow a click away.
 * It stays open while you pick — Today and Tomorrow are worked out as it draws, so they follow the real date — and
 * closes when you click outside it, press Escape, or press the button again.
 * `flow` makes the button fill its row (in a form).
 */
export function DatePicker({ value, onChange, allowClear = true, disabled = false, flow = false, ariaLabel, label: prefix, className = '' }: {
  value: string | null;
  onChange: (day: string | null) => void;
  allowClear?: boolean;
  disabled?: boolean;
  flow?: boolean;
  ariaLabel: string;
  /** Shown dimmed before the date, like FilterSelect's label. */
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(() => parseDayKey(value ?? dayKey(new Date())));
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);

  useDismiss(open, () => setOpen(false), [rootRef, panelRef]);

  const today = dayKey(new Date());
  const pick = (day: string | null) => { onChange(day); if (day) setShown(parseDayKey(day)); };

  // Placed from the button each time it opens or the page moves, below it (above, if there is no room).
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = rootRef.current?.getBoundingClientRect();
      if (!r) return;
      const height = panelRef.current?.offsetHeight ?? 340;
      const below = r.bottom + 6 + height <= window.innerHeight || r.top - 6 - height < 0;
      setAt({ left: Math.max(8, Math.min(r.left, window.innerWidth - 280)), top: below ? r.bottom + 6 : r.top - 6 - height });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, shown]);
  const step = (by: number) => setShown((d) => new Date(d.getFullYear(), d.getMonth() + by, 1));
  const toggle = () => {
    if (!open) setShown(parseDayKey(value ?? today));
    setOpen((o) => !o);
  };

  const panel = (
    <div ref={panelRef} style={{ position: 'fixed', left: at?.left ?? 0, top: at?.top ?? 0, visibility: at ? 'visible' : 'hidden' }} className="z-[10000] w-[272px] bg-paper-dark border border-ink/14 rounded-box p-3 flex flex-col gap-2 shadow-[0_12px_32px_rgba(0,0,0,0.18)]">
      <div className="flex items-center justify-between">
        <Button tone="ghost" size="sm" aria-label="Previous month" onClick={() => step(-1)} className="!px-2"><ChevronRight size={12} className="rotate-180" /></Button>
        <span className="font-mono-main text-[12px] uppercase tracking-[0.2em] font-bold">{shown.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
        <Button tone="ghost" size="sm" aria-label="Next month" onClick={() => step(1)} className="!px-2"><ChevronRight size={12} /></Button>
      </div>
      <div className="grid grid-cols-7 text-center font-mono-main text-[11px] uppercase text-ink/35">{WEEK.map((d) => <span key={d} className="py-1">{d}</span>)}</div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {monthGrid(shown.getFullYear(), shown.getMonth()).flat().map(({ key, inMonth }) => {
          const chosen = key === value;
          return (
            <button
              key={key}
              type="button"
              onClick={() => pick(key)}
              className={`h-8 rounded-full font-mono-main text-[13px] tabular-nums transition-colors ${chosen ? 'bg-ink text-paper font-bold' : key === today ? 'text-sepia font-bold hover:bg-ink/8' : inMonth ? 'hover:bg-ink/8' : 'text-ink/25 hover:bg-ink/8'}`}
            >{Number(key.slice(8))}</button>
          );
        })}
      </div>
      <div className="spring-group flex gap-2 pt-1 border-t border-ink/10 mt-1">
        <Button size="sm" tone="outline" onClick={() => pick(today)}>Today</Button>
        <Button size="sm" tone="outline" onClick={() => pick(addDays(today, 1))}>Tomorrow</Button>
        {allowClear && value && <Button size="sm" tone="ghost" onClick={() => pick(null)}>Clear</Button>}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className={`${flow ? 'block' : 'inline-block'} ${className}`}>
      <Button tone="outline" size="sm" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-label={ariaLabel} onClick={toggle} className={flow ? 'w-full !justify-between !py-3' : ''}>
        {prefix && <span className="text-ink/40">{prefix}</span>}
        <span>{label(value) ?? 'No date'}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </Button>
      {open && createPortal(panel, document.body)}
    </div>
  );
}
