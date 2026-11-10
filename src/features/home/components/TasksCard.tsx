import React from 'react';
import { Chip } from '@/ui/Chip';
import { FilterSelect } from '@/ui/FilterSelect';
import { WHOSE_OPTIONS, type Whose } from '@/data/useWhoseTasks';
import { projectLabel } from '@/domain/work/projects';
import type { Task } from '@/domain/work/types';
import { TasksVector } from '@/features/home/components/visuals';

/** The big card's body for Tasks: what is still to do today, with a tick to finish each. Clicking the card opens the work side. */
export const TasksCardBody: React.FC<{
  today: readonly Task[];
  projectName: (id: string | null) => string | null;
  onFinish: (task: Task) => void;
  /** Whose tasks are listed (the same choice as on the Tasks pages). */
  whose: Whose;
  onWhose: (value: Whose) => void;
}> = ({ today, projectName, onFinish, whose, onWhose }) => (
  <div className="flex-1 flex flex-col justify-between">
    <div className="flex justify-between items-start">
      <h2 className="text-silver text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mt-1">TASKS</h2>
      <div className="flex items-center gap-4">
        {/* Clicking the card opens the Tasks home, so a click on the filter must not. */}
        <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <FilterSelect label="Whose" options={WHOSE_OPTIONS} value={whose} onChange={onWhose} />
        </div>
        <div className="text-ink opacity-60">
          <TasksVector size={36} />
        </div>
      </div>
    </div>

    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 mt-6">
      <div className="flex flex-col gap-3 min-w-0 flex-1">
        {today.length === 0 ? (
          <p className="font-mono-main text-[15px] text-ink/45">Nothing left for today.</p>
        ) : today.slice(0, 5).map((task) => {
          const project = projectLabel(task, projectName);
          return (
            <div key={task.id} className="flex items-center gap-3 min-w-0 rounded-box bg-ink/5 px-3.5 py-2.5">
              <button
                type="button"
                aria-label="Mark as done"
                data-tip="Done"
                onClick={(e) => { e.stopPropagation(); onFinish(task); }}
                className="shrink-0 w-5 h-5 rounded-full border border-ink/30 hover:border-ink hover:bg-ink/10 transition-colors"
              />
              <span dir="auto" className="font-sans-main text-[16px] font-semibold truncate text-left min-w-0 flex-1">{task.title || 'Untitled'}</span>
              {project && <Chip tone="neutral" className="hidden sm:inline-flex shrink-0 max-w-[160px] !normal-case !tracking-normal"><span dir="auto" className="truncate">{project}</span></Chip>}
            </div>
          );
        })}
        {today.length > 5 && <span className="font-mono-main text-[12px] text-ink/45">+{today.length - 5} more today</span>}
      </div>
    </div>
  </div>
);
