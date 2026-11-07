import { motion } from 'framer-motion';
import { SPRING } from '@/ui/springPose';

/**
 * The system's tab / period switcher: plain mono labels, the current one in full ink with a
 * line under it that slides to the next. No boxes. `layoutId` must be unique per switcher
 * on screen so the line only travels within its own.
 */
export function Tabs<T extends string>({ options, value, onChange, layoutId, ruled = false, className = '' }: {
  options: ReadonlyArray<{ value: T; label?: string }>;
  value: T;
  onChange: (value: T) => void;
  layoutId: string;
  /** A hairline runs along the bottom, with the sliding line sitting on it. */
  ruled?: boolean;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={`flex items-center gap-6 sm:gap-8 overflow-x-auto ${ruled ? 'border-b border-ink/12' : ''} ${className}`}
      style={{ scrollbarWidth: 'none' }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative shrink-0 pb-2.5 font-mono-main text-[10px] uppercase tracking-[0.2em] font-bold cursor-pointer transition-colors duration-200 hover:text-ink ${active ? 'text-ink' : 'text-ink/40'}`}
          >
            {o.label ?? o.value}
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute left-0 right-0 -bottom-px h-0.5 bg-ink"
                transition={SPRING}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
