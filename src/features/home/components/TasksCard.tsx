import React from 'react';
import { Button } from '@/ui/Button';
import { IconPlus as Plus } from '@/ui/icons';
import type { Task } from '@/domain/work/types';
import { TasksVector } from '@/features/home/components/visuals';

/** The big card's body for Tasks: what is still to do today, with a tick to finish each, and the way in to the work side. */
export const TasksCardBody: React.FC<{
  today: readonly Task[];
  projectName: (id: string | null) => string | null;
  onFinish: (task: Task) => void;
  onOpen: (e: React.MouseEvent) => void;
}> = ({ today, projectName, onFinish, onOpen }) => (
  <div className="flex-1 flex flex-col justify-between">
    <div className="flex justify-between items-start">
      <h2 className="text-silver text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mt-1">TASKS</h2>
      <div className="text-ink opacity-60">
        <TasksVector size={36} />
      </div>
    </div>

    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 mt-6">
      <div className="flex flex-col gap-3 min-w-0 flex-1">
        {today.length === 0 ? (
          <p className="font-mono-main text-sm text-ink/45">Nothing left for today.</p>
        ) : today.slice(0, 5).map((task) => (
          <div key={task.id} className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Mark as done"
              data-tip="Done"
              onClick={(e) => { e.stopPropagation(); onFinish(task); }}
              className="shrink-0 w-5 h-5 rounded-full border border-ink/30 hover:border-ink hover:bg-ink/10 transition-colors"
            />
            <span dir="auto" className="font-sans-main text-[15px] font-semibold truncate">{task.title || 'Untitled'}</span>
            <span dir="auto" className="hidden sm:block font-mono-main text-[9px] uppercase tracking-wider text-ink/40 truncate shrink-0 max-w-[140px]">{projectName(task.projectId)}</span>
          </div>
        ))}
        {today.length > 5 && <span className="font-mono-main text-[10px] text-ink/40">+{today.length - 5} more today</span>}
      </div>
      <Button onClick={onOpen}><Plus size={18} />Open tasks</Button>
    </div>
  </div>
);
