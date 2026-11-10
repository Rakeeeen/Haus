import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { useDismiss } from '@/ui/useDismiss';
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

/** Whether `option` answers what was typed (any part of its label, ignoring case). */
const matches = (option: MenuOption, typed: string) => !typed.trim() || option.label.toLowerCase().includes(typed.trim().toLowerCase());

/** Open/closed state for a menu, closed by a click outside the field and its list, or by Escape. */
function useOpenMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useDismiss(open, () => setOpen(false), [rootRef, listRef]);
  return { open, setOpen, rootRef, listRef };
}

// One fixed height, so the field is the same size closed (a name), open (the box you type in) and with a photo in it.
const BOX = `${base} h-[52px] px-4 pr-10 text-[16px] text-left flex items-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed`;

/**
 * The field of a dropdown: closed, it names what is chosen; open, the same place takes what you type to narrow the list
 * (a long list of projects or people is found by typing a bit of the name).
 */
const MenuField: React.FC<{
  open: boolean; disabled: boolean; ariaLabel: string; typed: string; onType: (value: string) => void; onToggle: () => void;
  onEnter: () => void; children: React.ReactNode;
}> = ({ open, disabled, ariaLabel, typed, onType, onToggle, onEnter, children }) => (
  <div className="relative">
    {open ? (
      <div className={`${BOX} border-ink`}>
        <input
          autoFocus
          dir="auto"
          value={typed}
          aria-label={ariaLabel}
          placeholder="Type to find…"
          onChange={(e) => onType(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onEnter(); } }}
          className="w-full bg-transparent outline-none text-[16px] placeholder:text-ink/35"
        />
      </div>
    ) : (
      <button type="button" disabled={disabled} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={false} onClick={onToggle} className={BOX}>
        {children}
      </button>
    )}
    <button
      type="button"
      tabIndex={-1}
      aria-hidden
      disabled={disabled}
      onClick={onToggle}
      className="absolute right-0 top-0 h-full w-11 flex items-center justify-center text-ink/40 disabled:opacity-50"
    >
      <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
    </button>
  </div>
);

const LIST = 'z-[10000] max-h-60 overflow-y-auto bg-paper-dark border border-ink/14 rounded-box shadow-[0_12px_32px_rgba(0,0,0,0.18)]';

/**
 * The open list, floating over the page from the field's position (below it, or above if there is no room). It is not part
 * of the form's own layout, so opening it never makes a form scroll or a card grow.
 */
const FloatingList: React.FC<{ anchor: React.RefObject<HTMLDivElement>; listRef: React.RefObject<HTMLUListElement>; multi?: boolean; children: React.ReactNode }> = ({ anchor, listRef, multi = false, children }) => {
  const [at, setAt] = useState<{ left: number; top: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      const height = listRef.current?.offsetHeight ?? 240;
      const below = r.bottom + 4 + height <= window.innerHeight || r.top - 4 - height < 0;
      const next = { left: r.left, top: below ? r.bottom + 4 : r.top - 4 - height, width: r.width };
      // Only when it has actually moved: setting state on every render would never settle.
      setAt((prev) => (prev && prev.left === next.left && prev.top === next.top && prev.width === next.width ? prev : next));
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  });
  return createPortal(
    <ul
      ref={listRef}
      role="listbox"
      aria-multiselectable={multi || undefined}
      className={`${LIST} fixed`}
      style={{ left: at?.left ?? 0, top: at?.top ?? 0, width: at?.width ?? 0, visibility: at ? 'visible' : 'hidden' }}
    >
      {children}
    </ul>,
    document.body,
  );
};
const ROW = 'w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 font-mono-main text-[14px] transition-colors hover:bg-ink/5';

/** A form dropdown in the system's own style (never the browser's): a short list that scrolls inside itself, and is found by typing. */
export const SelectMenu: React.FC<{
  options: readonly MenuOption[]; value: string; onChange: (value: string) => void; disabled?: boolean; ariaLabel: string;
}> = ({ options, value, onChange, disabled = false, ariaLabel }) => {
  const { open, setOpen, rootRef, listRef } = useOpenMenu();
  const [typed, setTyped] = useState('');
  const current = options.find((o) => o.value === value);
  const shown = options.filter((o) => matches(o, typed));
  const pick = (v: string) => { onChange(v); setOpen(false); setTyped(''); };
  const toggle = () => { setTyped(''); setOpen(!open); };

  return (
    <div ref={rootRef} className="relative">
      <MenuField open={open} disabled={disabled} ariaLabel={ariaLabel} typed={typed} onType={setTyped} onToggle={toggle} onEnter={() => shown[0] && pick(shown[0].value)}>
        {current?.withAvatar && <Avatar name={current.label} photoUrl={current.photoUrl} size={22} />}
        <span dir="auto" className="truncate">{current?.label ?? '—'}</span>
      </MenuField>
      {open && (
        <FloatingList anchor={rootRef} listRef={listRef}>
          {shown.length === 0 && <li className="px-3.5 py-2.5 font-mono-main text-[13px] text-ink/40">Nothing matches.</li>}
          {shown.map((o) => (
            <li key={o.value} role="none">
              <button role="option" aria-selected={o.value === value} type="button" onClick={() => pick(o.value)} className={`${ROW} ${o.value === value ? 'text-ink font-bold' : 'text-ink/60'}`}>
                {o.withAvatar && <Avatar name={o.label} photoUrl={o.photoUrl} size={22} />}
                <span dir="auto" className="truncate">{o.label}</span>
              </button>
            </li>
          ))}
        </FloatingList>
      )}
    </div>
  );
};

/** Like SelectMenu, but several can be chosen: each line switches on or off, and the list stays open until you close it. */
export const SelectMulti: React.FC<{
  options: readonly MenuOption[]; values: readonly string[]; onChange: (values: string[]) => void; disabled?: boolean; ariaLabel: string; empty?: string;
}> = ({ options, values, onChange, disabled = false, ariaLabel, empty = 'None' }) => {
  const { open, setOpen, rootRef, listRef } = useOpenMenu();
  const [typed, setTyped] = useState('');
  const chosen = options.filter((o) => values.includes(o.value));
  const shown = options.filter((o) => matches(o, typed));
  const toggleValue = (v: string) => { onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]); setTyped(''); };
  const toggle = () => { setTyped(''); setOpen(!open); };

  return (
    <div ref={rootRef} className="relative">
      <MenuField open={open} disabled={disabled} ariaLabel={ariaLabel} typed={typed} onType={setTyped} onToggle={toggle} onEnter={() => shown[0] && toggleValue(shown[0].value)}>
        {chosen.length === 0 ? <span className="text-ink/45">{empty}</span> : (
          <>
            {chosen[0].withAvatar && <Avatar name={chosen[0].label} photoUrl={chosen[0].photoUrl} size={22} />}
            <span dir="auto" className="truncate">{chosen.map((o) => o.label).join(', ')}</span>
          </>
        )}
      </MenuField>
      {open && (
        <FloatingList anchor={rootRef} listRef={listRef} multi>
          {shown.length === 0 && <li className="px-3.5 py-2.5 font-mono-main text-[13px] text-ink/40">Nothing matches.</li>}
          {shown.map((o) => {
            const on = values.includes(o.value);
            return (
              <li key={o.value} role="none">
                <button role="option" aria-selected={on} type="button" onClick={() => toggleValue(o.value)} className={`${ROW} ${on ? 'text-ink font-bold' : 'text-ink/60'}`}>
                  <span aria-hidden className="shrink-0 w-4">{on ? '■' : '□'}</span>
                  {o.withAvatar && <Avatar name={o.label} photoUrl={o.photoUrl} size={22} />}
                  <span dir="auto" className="truncate">{o.label}</span>
                </button>
              </li>
            );
          })}
          {values.length > 0 && (
            <li>
              <button type="button" onClick={() => onChange([])} className="w-full text-left px-3.5 py-2.5 border-t border-ink/10 font-mono-main text-[12px] uppercase tracking-[0.2em] text-ink/45 hover:bg-ink/5 transition-colors">Clear</button>
            </li>
          )}
        </FloatingList>
      )}
    </div>
  );
};

/** A row of buttons to pick one value from; they share space like every button row. `colors` dresses a chosen one. */
export function ChooseRow<T extends string>({ options, value, onChange, disabled = false, colors }: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  colors?: Partial<Record<T, string>>;
}) {
  return (
    <div className="spring-group flex flex-wrap gap-2">
      {options.map((o) => (
        <Button key={o.value} size="sm" tone={o.value === value ? 'ink' : 'outline'} disabled={disabled} onClick={() => onChange(o.value)}
          className={o.value === value ? colors?.[o.value] ?? '' : ''}>{o.label}</Button>
      ))}
    </div>
  );
}
