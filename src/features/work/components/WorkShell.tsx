import React from 'react';
import { isRtlText } from '@/domain/work/text';
import { IconArrowLeft as ArrowLeft, IconChevronRight as ChevronRight } from '@/ui/icons';

/** The frame every work page shares: the way back, the title, what the page offers up top, then its content. */
export const WorkShell: React.FC<{
  crumbs: ReadonlyArray<{ label: string; to?: string }>;
  title: string;
  navigate: (to: string) => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ crumbs, title, navigate, actions, children }) => (
  <div className="min-h-screen bg-bg text-ink py-6 md:py-12 px-6 md:px-12 lg:px-20 font-sans-main flex flex-col transition-colors duration-300">
    <header className="w-full max-w-[1200px] mx-auto mb-10">
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {crumbs.map((crumb, i) => (
          <React.Fragment key={crumb.label}>
            {i > 0 && <ChevronRight size={12} className="text-ink/20" />}
            {crumb.to !== undefined ? (
              <button
                onClick={() => navigate(crumb.to as string)}
                className="flex items-center gap-2 text-ink/40 hover:text-ink transition-colors group"
              >
                {i === 0 && <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />}
                <span className="font-mono-main text-[12px] uppercase tracking-[0.25em] font-bold">{crumb.label}</span>
              </button>
            ) : (
              <span className="font-mono-main text-[12px] uppercase tracking-[0.25em] font-bold text-ink/50">{crumb.label}</span>
            )}
          </React.Fragment>
        ))}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        {/* Arabic is joined up, so it takes no letter-spacing or capitals; its marks sit lower and higher than Latin's, so the
            line is taller (the silver is painted through the letters, and a tight line cuts them off). */}
        <h1
          dir="auto"
          className={`text-silver font-sans-main text-4xl sm:text-5xl md:text-6xl font-black max-w-full break-words pt-[0.12em] pb-[0.2em] leading-[1.25] ${isRtlText(title) ? '' : 'uppercase tracking-tight'}`}
        >{title}</h1>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </header>
    <main className="w-full max-w-[1200px] mx-auto flex flex-col gap-6">{children}</main>
  </div>
);
