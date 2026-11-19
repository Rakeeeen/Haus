import React, { useCallback, useMemo, useState } from 'react';
import { ContextMenu } from '@/ui/ContextMenu';
import { asNewTask } from '@/domain/work/deletedTasks';
import type { Task } from '@/domain/work/types';
import type { useWork } from '@/data/useWork';
import { buildTaskMenu } from '@/features/work/taskMenu';

type Work = Pick<ReturnType<typeof useWork>, 'canEditTask' | 'canDeleteTask' | 'setTaskStatus' | 'updateTask' | 'addTask' | 'deleteTaskWithUndo'>;

/**
 * The right-click menu for tasks, for any screen that lists them. Put `onContextMenu(e, task)` on whatever shows a task, and
 * `menu` once on the page. `work` is the work data (null where there is none, and the menu then never opens); `open` adds an
 * "Open" line.
 */
export function useTaskMenu(work: Work | null, open?: (task: Task) => void) {
  const [shown, setShown] = useState<{ task: Task; at: { x: number; y: number } } | null>(null);

  const onContextMenu = useCallback((e: React.MouseEvent, task: Task) => {
    if (!work) return;
    e.preventDefault();
    e.stopPropagation();
    setShown({ task, at: { x: e.clientX, y: e.clientY } });
  }, [work]);

  const close = useCallback(() => setShown(null), []);

  const items = useMemo(() => {
    if (!shown || !work) return [];
    const { task } = shown;
    const quietly = (what: Promise<unknown> | void) => { void Promise.resolve(what).catch((error) => console.warn('Could not change the task:', error)); };
    return buildTaskMenu(task, {
      canEdit: work.canEditTask(task),
      canDelete: work.canDeleteTask(task),
      open: open ? () => open(task) : undefined,
      setStatus: (status) => quietly(work.setTaskStatus(task, status)),
      setPriority: (priority) => quietly(work.updateTask(task.id, { priority })),
      // A new day replaces an end date that would now come before it.
      setDate: (date) => quietly(work.updateTask(task.id, { date, endDate: null })),
      duplicate: () => quietly(work.addTask({ ...asNewTask(task), title: `${task.title} (copy)`, status: 'todo', doneAt: null })),
      copyTitle: () => { void navigator.clipboard?.writeText(task.title).catch(() => {}); },
      remove: () => work.deleteTaskWithUndo(task),
    });
  }, [shown, work, open]);

  const menu = <ContextMenu at={shown?.at ?? null} items={items} onClose={close} />;
  return { onContextMenu, menu };
}
