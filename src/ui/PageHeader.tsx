import React from 'react';
import { isRtlText } from '@/domain/work/text';
import { IconArrowLeft as ArrowLeft, IconChevronRight as ChevronRight } from '@/ui/icons';

export interface Crumb {
  label: string;
  /** Where it goes when clicked (`home` for the home page); the last crumb has none. */
  to?: string;
}

/**
 * The top of every page: the way back (`Home › Page`), the big silver title, and — if the page has them — something beside the
 * breadcrumb (`trailing`) and something beside the title (`aside`: tabs, or the page's main action).
 * An Arabic title takes no capitals or letter-spacing (the letters are joined up) and a taller line, because the silver is painted
 * through the letters and a tight line would cut off their marks.
 */
export const PageHeader: React.FC<{
  crumbs: readonly Crumb[];
  title: string;
  navigate: (to: string) => void;
  trailing?: React.ReactNode;
  aside?: React.ReactNode;
  /** Tailwind classes for the width and the room under the header. */
  className?: string;
}> = ({ crumbs, title, navigate, trailing, aside, className = 'max-w-[1000px] mb-12' }) => (
  <header className={`w-full mx-auto ${className}`}>
    <div className="flex items-center justify-between gap-4 mb-8">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2">
        {crumbs.map((crumb, i) => (
          <React.Fragment key={crumb.label}>
            {i > 0 && <ChevronRight size={12} className="text-ink/20" />}
            {crumb.to !== undefined ? (
              <button onClick={() => navigate(crumb.to as string)} className="flex items-center gap-2 text-ink/40 hover:text-ink transition-colors group">
                {i === 0 && <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />}
                <span className="font-mono-main text-[10px] uppercase tracking-[0.25em] font-bold">{crumb.label}</span>
              </button>
            ) : (
              <span aria-current="page" className="font-mono-main text-[10px] uppercase tracking-[0.25em] font-bold text-ink/50">{crumb.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>
      {trailing}
    </div>

    <div className="flex flex-wrap items-end justify-between gap-4 md:gap-6">
      <h1
        dir="auto"
        className={`text-silver font-sans-main text-4xl sm:text-5xl md:text-6xl font-black max-w-full break-words ${isRtlText(title) ? 'pt-[0.12em] pb-[0.2em] leading-[1.25]' : 'uppercase tracking-tight'}`}
      >{title}</h1>
      {aside}
    </div>
  </header>
);
