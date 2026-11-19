import React from 'react';
import { Chip } from '@/ui/Chip';
import { Avatar } from '@/ui/Avatar';
import { statusLabel } from '@/domain/work/tasks';
import type { Person } from '@/domain/work/people';
import { projectLabel } from '@/domain/work/projects';
import type { Task } from '@/domain/work/types';
import { SwipeRow } from '@/ui/SwipeRow';
import { CheerVector, TasksVector } from '@/features/home/components/visuals';

type RowProps = {
  task: Task;
  /** Swiping the row left deletes the task (with a way back), where this allows it. */
  onDelete?: (task: Task) => void;
  onContextMenu?: (e: React.MouseEvent, task: Task) => void;
  projectName: (id: string | null) => string | null;
  peopleOf: (task: Task) => Person[];
  onFinish: (task: Task) => void;
};

/** One task: a tick to finish it, its title, its status, who it is for and its project. */
const TaskRow: React.FC<RowProps> = ({ task, projectName, peopleOf, onFinish, onDelete, onContextMenu }) => {
  const project = projectLabel(task, projectName);
  const people = peopleOf(task);
  return (
    <SwipeRow enabled={!!onDelete} onDelete={() => onDelete?.(task)}>
    <div className="flex items-center gap-3 min-w-0 rounded-box bg-ink/5 px-3.5 py-2.5" onContextMenu={(e) => onContextMenu?.(e, task)}>
      <button
        type="button"
        aria-label="Mark as done"
        data-tip="Done"
        onClick={(e) => { e.stopPropagation(); onFinish(task); }}
        className="shrink-0 w-5 h-5 rounded-full border border-ink/30 hover:border-ink hover:bg-ink/10 transition-colors"
      />
      <span dir="auto" className="font-sans-main text-[16px] font-semibold truncate text-left min-w-0 flex-1">{task.title || 'Untitled'}</span>
      <Chip tone={task.status === 'doing' ? 'sepia' : 'neutral'} className="shrink-0">{statusLabel(task.status)}</Chip>
      {people.length > 0 && (
        <span className="flex shrink-0 -space-x-1.5" aria-label={people.map((p) => p.name).join(', ')}>
          {people.slice(0, 3).map((p) => <Avatar key={p.key} name={p.name} photoUrl={p.photoUrl} size={22} className="ring-2 ring-[var(--paper-dark)]" />)}
        </span>
      )}
      {project && <Chip tone="neutral" className="hidden sm:inline-flex shrink-0 max-w-[160px] !normal-case !tracking-normal"><span dir="auto" className="truncate">{project}</span></Chip>}
    </div>
    </SwipeRow>
  );
};

/**
 * The big card's body for Tasks: what is still to do today, with a tick to finish each. When today is clear it shows the
 * oldest task still waiting from before (labelled, so it reads as an old one) — and when there is none of those either,
 * an apple and a line of encouragement. Clicking the card opens the work side.
 */
export const TasksCardBody: React.FC<{
  today: readonly Task[];
  /** The task that has waited longest, when today has nothing left. */
  oldTask: Task | null;
  /** The tasks have loaded — until then an empty list says nothing, rather than "all done". */
  ready: boolean;
  /** What to say when there is nothing at all left to do. */
  cheer: string;
  projectName: (id: string | null) => string | null;
  /** Who a task is for; only their photos are shown. */
  peopleOf: (task: Task) => Person[];
  onFinish: (task: Task) => void;
  /** Where given, a task may be deleted by swiping its row. `canDelete` says which. */
  onDelete?: (task: Task) => void;
  canDelete?: (task: Task) => boolean;
  onContextMenu?: (e: React.MouseEvent, task: Task) => void;
}> = ({ today, oldTask, ready, cheer, projectName, peopleOf, onFinish, onDelete, canDelete = () => true, onContextMenu }) => (
  <div className="flex-1 flex flex-col justify-between">
    <div className="flex justify-between items-start">
      <h2 className="text-silver text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mt-1">TASKS</h2>
      <div className="text-ink">
        <TasksVector size={36} />
      </div>
    </div>

    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 mt-6">
      <div className="flex flex-col gap-3 min-w-0 flex-1">
        {today.length > 0 ? (
          <>
            {today.slice(0, 5).map((task) => <TaskRow key={task.id} task={task} projectName={projectName} peopleOf={peopleOf} onFinish={onFinish} onDelete={onDelete && canDelete(task) ? onDelete : undefined} onContextMenu={onContextMenu} />)}
            {today.length > 5 && <span className="font-mono-main text-[12px] text-ink/45">+{today.length - 5} more today</span>}
          </>
        ) : oldTask ? (
          <>
            <span className="font-mono-main text-[11px] font-bold uppercase tracking-widest text-ink/45">Old task — from before</span>
            <TaskRow task={oldTask} projectName={projectName} peopleOf={peopleOf} onFinish={onFinish} onDelete={onDelete && canDelete(oldTask) ? onDelete : undefined} onContextMenu={onContextMenu} />
          </>
        ) : !ready ? null : (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="shrink-0 text-ink"><CheerVector size={52} /></div>
            <p key={cheer} className="font-sans-main text-[18px] sm:text-[20px] font-semibold leading-snug text-ink/70 min-w-0">{cheer}</p>
          </div>
        )}
      </div>
    </div>
  </div>
);
