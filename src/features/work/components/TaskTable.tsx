import React from 'react';
import { AutoHeight } from '@/ui/AutoHeight';
import { projectLabel } from '@/domain/work/projects';
import { dayKey, isOverdue, sortTasks } from '@/domain/work/tasks';
import type { Task, TaskStatus } from '@/domain/work/types';
import { Avatar } from '@/ui/Avatar';
import type { PersonOf } from '@/features/work/components/TaskBoard';
import { StatusPicker } from '@/features/work/components/StatusPicker';
import { DoneTick } from '@/features/work/components/DoneTick';
import { PriorityChip, shortDate } from '@/features/work/components/chips';

/** The tasks as rows: the tick, the title, and what each is about. Opens a task on click. */
export const TaskTable: React.FC<{
  tasks: readonly Task[];
  projectName: (id: string | null) => string | null;
  canEdit?: (task: Task) => boolean;
  onOpen: (task: Task) => void;
  personOf?: PersonOf;
  onSetStatus?: (task: Task, status: TaskStatus) => void;
  onToggleDone: (task: Task) => void;
}> = ({ tasks, projectName, personOf, canEdit = () => true, onOpen, onToggleDone, onSetStatus }) => {
  const today = dayKey(new Date());
  const rows = sortTasks(tasks);
  if (rows.length === 0) return <p className="font-mono-main text-[13px] text-ink/40 py-10 text-center">Nothing here.</p>;
  return (
    <AutoHeight>
    <div className="card !p-0 overflow-hidden">
      <div className="hidden md:grid grid-cols-[28px_minmax(0,1.6fr)_minmax(0,1fr)_150px_96px_80px] gap-4 px-5 py-3 border-b border-ink/10 font-mono-main text-[11px] uppercase tracking-[0.2em] text-ink/35">
        <span /> <span>Task</span> <span>Project</span> <span>Status</span> <span>Date</span> <span>Priority</span>
      </div>
      {rows.map((task) => (
        <div
          key={task.id}
          onClick={() => onOpen(task)}
          className="grid grid-cols-[28px_minmax(0,1fr)] md:grid-cols-[28px_minmax(0,1.6fr)_minmax(0,1fr)_150px_96px_80px] items-center gap-x-4 gap-y-1 px-5 py-3 border-b border-ink/6 last:border-b-0 cursor-pointer hover:bg-ink/4 transition-colors"
        >
          {canEdit(task) ? <DoneTick done={task.status === 'done'} onToggle={() => onToggleDone(task)} /> : <span />}
          <span dir="auto" className={`font-sans-main text-[15px] font-semibold leading-relaxed truncate text-left ${task.status === 'done' || task.status === 'dropped' ? 'line-through text-ink/40' : ''}`}>{task.title || 'Untitled'}</span>
          <span dir="auto" className="col-start-2 md:col-start-auto font-mono-main text-[12px] leading-relaxed text-ink/50 truncate text-left">{projectLabel(task, projectName) ?? '—'}</span>
          <span className="hidden md:flex items-center gap-2">
            <StatusPicker status={task.status} editable={!!onSetStatus && canEdit(task)} onPick={(next) => onSetStatus?.(task, next)} />
            {(personOf?.(task) ?? []).slice(0, 2).map((p, i) => <Avatar key={i} name={p.name} photoUrl={p.photoUrl} size={20} />)}
          </span>
          <span className={`hidden md:block font-mono-main text-[12px] uppercase tracking-wider ${isOverdue(task, today) ? 'text-rust' : 'text-ink/50'}`}>{shortDate(task.date) || '—'}</span>
          <span className="hidden md:block"><PriorityChip priority={task.priority} /></span>
        </div>
      ))}
    </div>
    </AutoHeight>
  );
};
