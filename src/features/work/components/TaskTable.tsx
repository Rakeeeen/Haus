import React from 'react';
import { dayKey, isOverdue, sortTasks } from '@/domain/work/tasks';
import type { Task } from '@/domain/work/types';
import { DoneTick } from '@/features/work/components/TaskBoard';
import { PriorityChip, shortDate, TaskStatusChip } from '@/features/work/components/chips';

/** The tasks as rows: the tick, the title, and what each is about. Opens a task on click. */
export const TaskTable: React.FC<{
  tasks: readonly Task[];
  projectName: (id: string | null) => string | null;
  onOpen: (task: Task) => void;
  onToggleDone: (task: Task) => void;
}> = ({ tasks, projectName, onOpen, onToggleDone }) => {
  const today = dayKey(new Date());
  const rows = sortTasks(tasks);
  if (rows.length === 0) return <p className="font-mono-main text-[11px] text-ink/40 py-10 text-center">Nothing here.</p>;
  return (
    <div className="card !p-0 overflow-hidden">
      <div className="hidden md:grid grid-cols-[28px_1fr_minmax(0,180px)_96px_96px_80px] gap-4 px-5 py-3 border-b border-ink/10 font-mono-main text-[9px] uppercase tracking-[0.2em] text-ink/35">
        <span /> <span>Task</span> <span>Project</span> <span>Status</span> <span>Date</span> <span>Priority</span>
      </div>
      {rows.map((task) => (
        <div
          key={task.id}
          onClick={() => onOpen(task)}
          className="grid grid-cols-[28px_1fr] md:grid-cols-[28px_1fr_minmax(0,180px)_96px_96px_80px] items-center gap-x-4 gap-y-1 px-5 py-3 border-b border-ink/6 last:border-b-0 cursor-pointer hover:bg-ink/4 transition-colors"
        >
          <DoneTick done={task.status === 'done'} onToggle={() => onToggleDone(task)} />
          <span dir="auto" className={`font-sans-main text-[13px] font-semibold truncate ${task.status === 'done' || task.status === 'dropped' ? 'line-through text-ink/40' : ''}`}>{task.title || 'Untitled'}</span>
          <span dir="auto" className="col-start-2 md:col-start-auto font-mono-main text-[10px] uppercase tracking-wider text-ink/50 truncate">{projectName(task.projectId) ?? '—'}</span>
          <span className="hidden md:block"><TaskStatusChip status={task.status} /></span>
          <span className={`hidden md:block font-mono-main text-[10px] uppercase tracking-wider ${isOverdue(task, today) ? 'text-rust' : 'text-ink/50'}`}>{shortDate(task.date) || '—'}</span>
          <span className="hidden md:block"><PriorityChip priority={task.priority} /></span>
        </div>
      ))}
    </div>
  );
};
