import { useEffect, useRef, useState } from 'react';
import { Button } from '@/ui/Button';
import { IconChevronDown as ChevronDown, IconChevronRight as ChevronRight } from '@/ui/icons';
import { addDays, dayKey, monthGrid, parseDayKey } from '@/domain/work/tasks';

const WEEK = ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr'];
const label = (key: string | null, now: Date = new Date()) => {
  if (!key) return null;
  const date = parseDayKey(key);
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
};

/**
 * Picks a day from a small calendar, with Today and Tomorrow a click away (they are worked out when the list opens, so
 * they follow the real date). `flow` opens the calendar in the page's flow (inside a scrolling form) instead of over it.
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

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc, true); };
  }, [open]);

  const today = dayKey(new Date());
  const pick = (day: string | null) => { onChange(day); setOpen(false); };
  const step = (by: number) => setShown((d) => new Date(d.getFullYear(), d.getMonth() + by, 1));
  const toggle = () => {
    if (!open) setShown(parseDayKey(value ?? today));
    setOpen((o) => !o);
  };

  const panel = (
    <div className={`${flow ? 'mt-2' : 'absolute left-0 top-full mt-1 z-30'} w-[272px] max-w-full bg-paper-dark border border-ink/14 rounded-box p-3 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <Button tone="ghost" size="sm" aria-label="Previous month" onClick={() => step(-1)} className="!px-2"><ChevronRight size={12} className="rotate-180" /></Button>
        <span className="font-mono-main text-[10px] uppercase tracking-[0.2em] font-bold">{shown.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
        <Button tone="ghost" size="sm" aria-label="Next month" onClick={() => step(1)} className="!px-2"><ChevronRight size={12} /></Button>
      </div>
      <div className="grid grid-cols-7 text-center font-mono-main text-[9px] uppercase text-ink/35">{WEEK.map((d) => <span key={d} className="py-1">{d}</span>)}</div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {monthGrid(shown.getFullYear(), shown.getMonth()).flat().map(({ key, inMonth }) => {
          const chosen = key === value;
          return (
            <button
              key={key}
              type="button"
              onClick={() => pick(key)}
              className={`h-8 rounded-full font-mono-main text-[11px] tabular-nums transition-colors ${chosen ? 'bg-ink text-paper font-bold' : key === today ? 'text-sepia font-bold hover:bg-ink/8' : inMonth ? 'hover:bg-ink/8' : 'text-ink/25 hover:bg-ink/8'}`}
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
    <div ref={rootRef} className={`relative ${flow ? '' : 'inline-block'} ${className}`}>
      <Button tone="outline" size="sm" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-label={ariaLabel} onClick={toggle} className={flow ? 'w-full !justify-between !py-3' : ''}>
        {prefix && <span className="text-ink/40">{prefix}</span>}
        <span>{label(value) ?? 'No date'}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </Button>
      {open && panel}
    </div>
  );
}
