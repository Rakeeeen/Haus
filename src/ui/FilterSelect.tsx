import { useEffect, useRef, useState } from 'react';
import { Button } from '@/ui/Button';
import { IconChevronDown as ChevronDown } from '@/ui/icons';

/** The Week / Month / Year choice the chart screens share. */
export const PERIOD_OPTIONS = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
] as const;

/**
 * A real filter: a small button naming what's being shown, opening a short list to pick
 * from. For narrowing a list or a chart (a period, a range) — page-level navigation uses
 * Tabs instead.
 */
export function FilterSelect<T extends string>({ label, options, value, onChange, className = '' }: {
  /** What is being filtered, shown dimmed before the current choice. */
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <Button tone="outline" size="sm" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="text-ink/40">{label}</span>
        <span>{current?.label}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full mt-1 z-30 min-w-full bg-paper-dark border border-ink/14 rounded-box overflow-hidden"
        >
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full text-left px-3.5 py-2.5 cursor-pointer whitespace-nowrap font-mono-main text-[10px] uppercase tracking-[0.2em] font-bold transition-colors hover:bg-ink/5 ${selected ? 'text-ink' : 'text-ink/60'}`}
                >
                  {selected ? '● ' : '○ '}{o.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
