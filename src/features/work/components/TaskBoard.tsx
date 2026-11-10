import React, { useEffect, useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { projectLabel } from '@/domain/work/projects';
import { groupByStatus, isOverdue, dayKey, TASK_STATUSES } from '@/domain/work/tasks';
import type { Task, TaskStatus } from '@/domain/work/types';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { IconPlus as Plus } from '@/ui/icons';
import { PriorityChip, shortDate } from '@/features/work/components/chips';

/** The small round tick that finishes (or reopens) a task. */
export const DoneTick: React.FC<{ done: boolean; onToggle: () => void }> = ({ done, onToggle }) => (
  <button
    type="button"
    aria-label={done ? 'Mark as not done' : 'Mark as done'}
    data-tip={done ? 'Reopen' : 'Done'}
    onClick={(e) => { e.stopPropagation(); onToggle(); }}
    onPointerDown={(e) => e.stopPropagation()}
    className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${done ? 'bg-ink/70 border-ink/70 text-paper' : 'border-ink/30 hover:border-ink text-transparent hover:text-ink/40'}`}
  >
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.3 4.2 7.5 8 2.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
  </button>
);

export type PersonOf = (task: Task) => { name: string; photoUrl: string | null } | null;

const TaskCard: React.FC<{
  task: Task; projectName: string | null; person?: { name: string; photoUrl: string | null } | null; editable?: boolean;
  onOpen: () => void; onToggleDone: () => void; overlay?: boolean;
}> = ({ task, projectName, person = null, editable = true, onOpen, onToggleDone, overlay = false }) => {
  const overdue = isOverdue(task, dayKey(new Date()));
  return (
    <div
      onClick={onOpen}
      className={`rounded-box border border-ink/12 bg-paper-dark p-3 text-left select-none ${overlay ? 'rotate-1' : 'hover:border-ink/35'} transition-colors`}
    >
      <div className="flex items-start gap-2.5">
        {editable ? <DoneTick done={task.status === 'done'} onToggle={onToggleDone} /> : <span className="shrink-0 w-5 h-5" />}
        <p dir="auto" className={`font-sans-main text-[15px] font-semibold leading-relaxed text-left break-words min-w-0 ${task.status === 'done' || task.status === 'dropped' ? 'line-through text-ink/40' : ''}`}>
          {task.title || 'Untitled'}
        </p>
      </div>
      {(projectName || task.date || task.priority || person) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-2.5 pl-[30px]">
          {projectName && <span dir="auto" className="font-mono-main text-[11px] tracking-wider text-ink/45 truncate max-w-full text-left">{projectName}</span>}
          {task.date && <span className={`font-mono-main text-[11px] uppercase tracking-wider ${overdue ? 'text-rust' : 'text-ink/45'}`}>{shortDate(task.date)}</span>}
          <PriorityChip priority={task.priority} />
          {person && (
            <span className="ml-auto flex items-center gap-1.5 min-w-0">
              <Avatar name={person.name} photoUrl={person.photoUrl} size={16} />
              <span dir="auto" className="font-mono-main text-[11px] tracking-wider text-ink/50 truncate max-w-[90px]">{person.name}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

const DraggableCard: React.FC<React.ComponentProps<typeof TaskCard>> = (props) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: props.task.id, disabled: props.editable === false });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, opacity: isDragging ? 0 : 1, touchAction: 'manipulation' }}
    >
      <TaskCard {...props} />
    </div>
  );
};

const Column: React.FC<{
  status: TaskStatus; label: string; tasks: Task[]; projectName: (id: string | null) => string | null; personOf?: PersonOf; canEdit: (task: Task) => boolean;
  onOpen: (task: Task) => void; onToggleDone: (task: Task) => void; onAdd?: (status: TaskStatus) => void;
}> = ({ status, label, tasks, projectName, personOf, canEdit, onOpen, onToggleDone, onAdd }) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2.5 rounded-card p-3 min-h-[160px] transition-colors ${isOver ? 'bg-ink/8' : 'bg-ink/4'}`}
    >
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="font-mono-main text-[12px] uppercase tracking-[0.2em] font-bold text-ink/60">{label}</span>
        <span className="font-mono-main text-[12px] text-ink/35 tabular-nums">{tasks.length}</span>
      </div>
      {tasks.map((task) => (
        <DraggableCard key={task.id} task={task} projectName={projectLabel(task, projectName)} person={personOf?.(task) ?? null} editable={canEdit(task)} onOpen={() => onOpen(task)} onToggleDone={() => onToggleDone(task)} />
      ))}
      {onAdd && (
        <Button tone="ghost" size="sm" onClick={() => onAdd(status)} className="justify-start !px-2">
          <Plus size={12} /> New task
        </Button>
      )}
    </div>
  );
};

/**
 * The tasks in columns by status. A card is dragged to another column to change its status (touch works too: press
 * and hold a moment); clicking one opens it; the tick finishes it.
 */
export const TaskBoard: React.FC<{
  tasks: readonly Task[];
  projectName: (id: string | null) => string | null;
  /** Who a task is for (name and photo), shown on its card. */
  personOf?: PersonOf;
  showDropped?: boolean;
  /** Which tasks this person may move and finish (a guest's own); defaults to all. */
  canEdit?: (task: Task) => boolean;
  onOpen: (task: Task) => void;
  onMove: (task: Task, status: TaskStatus) => void;
  onToggleDone: (task: Task) => void;
  onAdd?: (status: TaskStatus) => void;
}> = ({ tasks, projectName, personOf, showDropped = false, canEdit = () => true, onOpen, onMove, onToggleDone, onAdd }) => {
  const [dragging, setDragging] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );
  // A dropped card goes to its new column at once, instead of waiting for the saved copy to come back (which left
  // the old card showing in its old place for a moment). It lets go when the saved task shows that status.
  const [moved, setMoved] = useState<Record<string, TaskStatus>>({});
  useEffect(() => {
    setMoved((m) => {
      const keep = Object.entries(m).filter(([id, status]) => tasks.find((t) => t.id === id && t.status !== status));
      return keep.length === Object.keys(m).length ? m : Object.fromEntries(keep);
    });
  }, [tasks]);
  const shownTasks = useMemo(() => tasks.map((t) => (moved[t.id] && moved[t.id] !== t.status ? { ...t, status: moved[t.id] } : t)), [tasks, moved]);
  const groups = groupByStatus(shownTasks);
  const columns = TASK_STATUSES.filter((s) => showDropped || s.value !== 'dropped');

  const onDragStart = (e: DragStartEvent) => setDragging(tasks.find((t) => t.id === e.active.id) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    const task = tasks.find((t) => t.id === e.active.id);
    setDragging(null);
    const to = e.over?.id as TaskStatus | undefined;
    if (task && to && to !== task.status) {
      setMoved((m) => ({ ...m, [task.id]: to }));
      onMove(task, to);
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className={`grid grid-cols-1 gap-4 ${columns.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
        {columns.map((c) => (
          <Column key={c.value} status={c.value} label={c.label} tasks={groups[c.value]} projectName={projectName} personOf={personOf} canEdit={canEdit}
            onOpen={onOpen} onToggleDone={onToggleDone} onAdd={onAdd} />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragging && <TaskCard task={dragging} projectName={projectLabel(dragging, projectName)} person={personOf?.(dragging) ?? null} onOpen={() => {}} onToggleDone={() => {}} overlay />}
      </DragOverlay>
    </DndContext>
  );
};
