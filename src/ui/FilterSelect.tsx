import { useEffect, useRef, useState } from 'react';
import { Button } from '@/ui/Button';
import { IconChevronDown as ChevronDown } from '@/ui/icons';

/** The Week / Month / Year choice the chart screens share. */
export const PERIOD_OPTIONS = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
] as const;

/** A list longer than this gets a box to type in, to find a line by its name. */
const SEARCH_FROM = 8;

const FilterSearch = ({ typed, onType }: { typed: string; onType: (value: string) => void }) => (
  <li className="sticky top-0 bg-paper-dark border-b border-ink/10 p-2">
    <input
      autoFocus
      dir="auto"
      value={typed}
      onChange={(e) => onType(e.target.value)}
      placeholder="Type to find…"
      aria-label="Find in the list"
      className="w-full bg-ink/5 rounded-box px-3 py-2 text-[14px] outline-none font-mono-main placeholder:text-ink/35"
    />
  </li>
);

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
  const [typed, setTyped] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);
  const found = options.filter((o) => !typed.trim() || o.label.toLowerCase().includes(typed.trim().toLowerCase()));

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
      <Button tone="outline" size="sm" aria-haspopup="listbox" aria-expanded={open} onClick={() => { setTyped(''); setOpen((o) => !o); }}>
        <span className="text-ink/40">{label}</span>
        <span>{current?.label}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full mt-1 z-30 min-w-full max-h-64 overflow-y-auto bg-paper-dark border border-ink/14 rounded-box"
        >
          {options.length > SEARCH_FROM && <FilterSearch typed={typed} onType={setTyped} />}
          {found.length === 0 && <li className="px-3.5 py-2.5 font-mono-main text-[12px] text-ink/40">Nothing matches.</li>}
          {found.map((o) => {
            const selected = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full text-left px-3.5 py-2.5 cursor-pointer whitespace-nowrap font-mono-main text-[12px] uppercase tracking-[0.2em] font-bold transition-colors hover:bg-ink/5 ${selected ? 'text-ink' : 'text-ink/60'}`}
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

/**
 * A filter that keeps several choices at once (any mix of statuses, say): the button names what is picked, and each
 * line in the list switches on or off. Nothing picked means everything.
 */
export function FilterMulti<T extends string>({ label, options, values, onChange, allLabel = 'All', className = '' }: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  values: readonly T[];
  onChange: (values: T[]) => void;
  allLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const chosen = options.filter((o) => values.includes(o.value));
  const found = options.filter((o) => !typed.trim() || o.label.toLowerCase().includes(typed.trim().toLowerCase()));
  const summary = chosen.length === 0 ? allLabel : chosen.length <= 2 ? chosen.map((o) => o.label).join(', ') : `${chosen.length} chosen`;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const toggle = (value: T) => onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <Button tone="outline" size="sm" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="text-ink/40">{label}</span>
        <span>{summary}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open && (
        <ul role="listbox" aria-multiselectable className="absolute right-0 top-full mt-1 z-30 min-w-full max-h-64 overflow-y-auto bg-paper-dark border border-ink/14 rounded-box">
          {options.length > SEARCH_FROM && <FilterSearch typed={typed} onType={setTyped} />}
          {found.map((o) => {
            const selected = values.includes(o.value);
            return (
              <li key={o.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => toggle(o.value)}
                  className={`w-full text-left px-3.5 py-2.5 cursor-pointer whitespace-nowrap font-mono-main text-[12px] uppercase tracking-[0.2em] font-bold transition-colors hover:bg-ink/5 ${selected ? 'text-ink' : 'text-ink/60'}`}
                >
                  {selected ? '■ ' : '□ '}{o.label}
                </button>
              </li>
            );
          })}
          {values.length > 0 && (
            <li>
              <button type="button" onClick={() => onChange([])} className="w-full text-left px-3.5 py-2.5 border-t border-ink/10 font-mono-main text-[12px] uppercase tracking-[0.2em] text-ink/45 hover:bg-ink/5 transition-colors">
                Clear
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
