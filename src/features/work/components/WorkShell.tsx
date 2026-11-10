import React from 'react';
import { PageHeader, type Crumb } from '@/ui/PageHeader';

/** The frame every work page shares: the way back, the title, what the page offers up top, then its content. */
export const WorkShell: React.FC<{
  crumbs: readonly Crumb[];
  title: string;
  navigate: (to: string) => void;
  actions?: React.ReactNode;
  /** More room between the title and what follows it (by default the content sits close under it). */
  roomy?: boolean;
  children: React.ReactNode;
}> = ({ crumbs, title, navigate, actions, roomy = false, children }) => (
  <div className="min-h-screen text-ink py-6 md:py-12 px-6 md:px-12 lg:px-20 font-sans-main flex flex-col transition-colors duration-300">
    <PageHeader
      crumbs={crumbs}
      title={title}
      navigate={navigate}
      aside={actions && <div className="flex items-center gap-3">{actions}</div>}
      className={`max-w-[1200px] ${roomy ? 'mb-10 md:mb-12' : 'mb-6'}`}
    />
    <main className="w-full max-w-[1200px] mx-auto flex flex-col gap-6">{children}</main>
  </div>
);
