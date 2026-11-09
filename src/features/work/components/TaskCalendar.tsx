import React, { useMemo, useState } from 'react';
import { dayKey, monthGrid } from '@/domain/work/tasks';
import type { Task } from '@/domain/work/types';
import { Button, IconButton } from '@/ui/Button';
import { IconArrowLeft as Left, IconChevronRight as Right } from '@/ui/icons';

const WEEKDAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const SHOWN_PER_DAY = 3;

/** A month of tasks by their date (the week starts on Saturday). An empty day adds a task for it; a task opens. */
export const TaskCalendar: React.FC<{
  tasks: readonly Task[];
  onOpen: (task: Task) => void;
  onAddOnDay: (day: string) => void;
}> = ({ tasks, onOpen, onAddOnDay }) => {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const today = dayKey(new Date());
  const weeks = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.date) continue;
      const list = map.get(task.date);
      if (list) list.push(task); else map.set(task.date, [task]);
    }
    return map;
  }, [tasks]);

  const move = (by: number) => setCursor(({ year, month }) => {
    const d = new Date(year, month + by, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const title = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-sans-main text-xl font-black uppercase tracking-tight">{title}</h2>
        <div className="spring-group flex items-center gap-2">
          <IconButton size="sm" tone="outline" aria-label="Previous month" onClick={() => move(-1)}><Left size={14} /></IconButton>
          <Button size="sm" tone="outline" onClick={() => { const d = new Date(); setCursor({ year: d.getFullYear(), month: d.getMonth() }); }}>Today</Button>
          <IconButton size="sm" tone="outline" aria-label="Next month" onClick={() => move(1)}><Right size={14} /></IconButton>
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-ink/10">
          {WEEKDAYS.map((d) => <div key={d} className="px-2 py-2.5 text-center font-mono-main text-[9px] uppercase tracking-[0.2em] text-ink/35">{d}</div>)}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-ink/6 last:border-b-0">
            {week.map(({ key, inMonth }) => {
              const list = byDay.get(key) ?? [];
              const isToday = key === today;
              return (
                <div
                  key={key}
                  onClick={() => onAddOnDay(key)}
                  className={`min-h-[104px] p-1.5 border-r border-ink/6 last:border-r-0 cursor-pointer hover:bg-ink/4 transition-colors ${inMonth ? '' : 'opacity-40'}`}
                >
                  <div className={`font-mono-main text-[10px] mb-1.5 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-sepia text-white font-bold' : 'text-ink/50'}`}>
                    {Number(key.slice(8))}
                  </div>
                  <div className="flex flex-col gap-1">
                    {list.slice(0, SHOWN_PER_DAY).map((task) => (
                      <button
                        key={task.id}
                        onClick={(e) => { e.stopPropagation(); onOpen(task); }}
                        dir="auto"
                        className={`w-full text-left truncate rounded-[6px] px-1.5 py-1 font-sans-main text-[10px] font-semibold transition-colors ${
                          task.status === 'done' ? 'bg-forest/12 text-forest line-through' : task.status === 'dropped' ? 'bg-ink/6 text-ink/35 line-through' : task.status === 'doing' ? 'bg-sepia text-white' : 'bg-ink/8 hover:bg-ink/14'
                        }`}
                      >
                        {task.title || 'Untitled'}
                      </button>
                    ))}
                    {list.length > SHOWN_PER_DAY && <span className="font-mono-main text-[9px] text-ink/40 px-1">+{list.length - SHOWN_PER_DAY} more</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
