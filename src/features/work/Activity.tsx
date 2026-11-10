import React, { useEffect, useMemo, useState } from 'react';
import { NAME } from '@/constants/brand';
import { useActivityLog } from '@/data/activityLog';
import { useGuests } from '@/data/useMembers';
import { byDay, entriesOf } from '@/domain/activity';
import { parseDayKey } from '@/domain/work/tasks';
import { Avatar } from '@/ui/Avatar';
import { FilterSelect } from '@/ui/FilterSelect';
import { WorkLoading } from '@/features/work/components/WorkLoading';
import { WorkShell } from '@/features/work/components/WorkShell';

const dayTitle = (key: string): string =>
  parseDayKey(key).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const clock = (iso: string): string => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Hamed's log: what each guest did in Haus (signing in, adding or moving tasks, comments), newest first, for one person or everyone. */
export const Activity: React.FC<{ navigate: (to: string) => void }> = ({ navigate }) => {
  const { entries, ready } = useActivityLog(true);
  const { guests } = useGuests(true);
  const [who, setWho] = useState('all');

  useEffect(() => { document.title = `${NAME} — Logs`; }, []);

  const photoOf = useMemo(() => new Map(guests.filter((g) => g.uid).map((g) => [g.uid as string, g.photoUrl ?? null])), [guests]);
  const options = useMemo(() => [
    { value: 'all', label: 'Everyone' },
    ...guests.filter((g) => g.uid).map((g) => ({ value: g.uid as string, label: g.name || g.email })),
  ], [guests]);
  const shown = entriesOf(entries, who === 'all' ? null : who);
  const days = byDay(shown);

  return (
    <WorkShell navigate={navigate} crumbs={[{ label: 'Home', to: 'home' }, { label: 'Tasks', to: 'work' }, { label: 'Logs' }]} title="Logs">
      <div className="spring-group flex flex-wrap items-center gap-3">
        <FilterSelect label="Person" options={options} value={options.some((o) => o.value === who) ? who : 'all'} onChange={setWho} />
      </div>
      <hr className="border-0 border-t border-ink/10 w-full my-2" />
      {!ready ? <WorkLoading /> : days.length === 0 ? (
        <p className="font-mono-main text-[13px] text-ink/40 py-10 text-center">Nothing yet — a guest's actions will show up here.</p>
      ) : days.map(({ day, entries: list }) => (
        <section key={day} className="card !p-0 overflow-hidden">
          <h2 className="px-5 py-3 border-b border-ink/10 font-mono-main text-[11px] uppercase tracking-[0.2em] text-ink/40">{dayTitle(day)}</h2>
          {list.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-5 py-3 border-b border-ink/6 last:border-b-0">
              <Avatar name={e.name} photoUrl={photoOf.get(e.uid) ?? null} size={28} />
              <div className="min-w-0 flex-1">
                <p dir="auto" className="font-sans-main text-[15px] leading-relaxed text-left"><span className="font-bold">{e.name}</span> <span className="text-ink/70">{e.text}</span></p>
              </div>
              <span className="font-mono-main text-[12px] tracking-wider text-ink/40 shrink-0">{clock(e.at)}</span>
            </div>
          ))}
        </section>
      ))}
    </WorkShell>
  );
};
