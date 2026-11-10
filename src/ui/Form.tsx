import React, { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/ui/Avatar';
import { IconChevronDown as ChevronDown } from '@/ui/icons';

/** The form pieces the work screens share: a labelled field, a text input, a text area and a dropdown. */
const base = 'w-full font-mono-main outline-none transition-colors bg-ink/5 border border-ink/12 focus:border-ink text-ink rounded-box';

export const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
  // A div, not a label: a label hands its :hover and clicks to the first control inside, which lit "To do" when
  // "Done" was hovered in a row of buttons.
  <div role="group" aria-label={label} className={`block ${className}`}>
    <span className="font-sans-main uppercase tracking-widest block mb-2 text-[12px] font-semibold text-ink/40">{label}</span>
    {children}
  </div>
);

export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => (
  <input {...props} className={`${base} px-4 py-3 text-[16px] ${className}`} />
);

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className = '', ...props }) => (
  <textarea {...props} className={`${base} px-4 py-3 text-[16px] leading-relaxed resize-y min-h-[120px] ${className}`} />
);

export interface MenuOption { value: string; label: string; photoUrl?: string | null; withAvatar?: boolean }

/** A form dropdown in the system's own style (never the browser's): a short list that scrolls inside itself. */
export const SelectMenu: React.FC<{
  options: readonly MenuOption[]; value: string; onChange: (value: string) => void; disabled?: boolean; ariaLabel: string;
}> = ({ options, value, onChange, disabled = false, ariaLabel }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc, true); };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`${base} px-4 py-3 pr-10 text-[16px] text-left flex items-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {current?.withAvatar && <Avatar name={current.label} photoUrl={current.photoUrl} size={20} />}
        <span dir="auto" className="truncate">{current?.label ?? '—'}</span>
        <ChevronDown size={14} className={`absolute right-4 top-1/2 -translate-y-1/2 text-ink/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul role="listbox" className="absolute left-0 right-0 top-full mt-1 z-30 max-h-56 overflow-y-auto bg-paper-dark border border-ink/14 rounded-box">
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 font-mono-main text-[14px] transition-colors hover:bg-ink/5 ${o.value === value ? 'text-ink font-bold' : 'text-ink/60'}`}
              >
                {o.withAvatar && <Avatar name={o.label} photoUrl={o.photoUrl} size={20} />}
                <span dir="auto" className="truncate">{o.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
