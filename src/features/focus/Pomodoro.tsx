import React, { useEffect } from 'react';
import { NAME } from '@/constants/brand';
import { PageHeader } from '@/ui/PageHeader';
import { Tabs } from '@/ui/Tabs';
import { FocusAnalysis } from '@/features/focus/FocusAnalysis';
import { FocusSessionCard } from '@/features/focus/FocusSessionCard';

const PAGE_TABS = [{ value: 'focus', label: 'Focus Time' }, { value: 'analysis', label: 'Analysis' }] as const;

/** The Focus page: the timer on one tab, the analysis of past sessions on the other. */
export const Pomodoro: React.FC<{ navigate: (to: string) => void }> = ({ navigate }) => {
  const [tab, setTab] = React.useState<'focus' | 'analysis'>('focus');
  useEffect(() => { document.title = `${NAME} — Focus`; }, []);

  return (
    <div className="min-h-screen text-ink py-6 md:py-12 px-6 md:px-12 lg:px-20 font-sans-main flex flex-col transition-colors duration-300">
      <PageHeader
        crumbs={[{ label: 'Home', to: 'home' }, { label: 'Focus' }]}
        title="Focus time"
        navigate={navigate}
        aside={<Tabs layoutId="pomodoroTab" ruled value={tab} onChange={setTab} options={PAGE_TABS} className="md:mb-1" />}
      />
      <main className="w-full max-w-[1000px] mx-auto flex flex-col gap-6">
        {tab === 'focus' && <FocusSessionCard />}
        {tab === 'analysis' && <FocusAnalysis />}
      </main>
    </div>
  );
};
