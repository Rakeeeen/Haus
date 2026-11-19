import { compareTasks, coversDay, dayKey, isOverdue, isOpen, lastDayOf } from '@/domain/work/tasks';
import { isFor } from '@/domain/work/sharing';
import type { Task } from '@/domain/work/types';

/** What the Tasks card's dots show: today's tasks (done and still open) and the older ones still waiting. */
export interface TaskProgress {
  /** Open tasks that ended before today. */
  carried: number;
  /** Today's tasks already done. */
  done: number;
  /** Today's tasks still to do. */
  open: number;
}

const mine = (task: Task, forMe: string | undefined) => !forMe || isFor(task, forMe);

/** Counts for the dots. `forMe` narrows to one person's tasks, as the card's list does; `now` decides what today is. */
export function taskProgress(tasks: readonly Task[], forMe?: string, now: Date = new Date()): TaskProgress {
  const today = dayKey(now);
  let carried = 0, done = 0, open = 0;
  for (const task of tasks) {
    if (!mine(task, forMe)) continue;
    if (isOverdue(task, today)) carried++;
    else if (coversDay(task, today)) {
      if (task.status === 'done') done++;
      else if (isOpen(task)) open++;
    }
  }
  return { carried, done, open };
}

/** The task that has waited longest (ended earliest, then by the usual order), or null when nothing is left behind. */
export function oldestCarried(tasks: readonly Task[], forMe?: string, now: Date = new Date()): Task | null {
  const today = dayKey(now);
  const waiting = tasks.filter((task) => mine(task, forMe) && isOverdue(task, today));
  waiting.sort((a, b) => (lastDayOf(a) ?? '').localeCompare(lastDayOf(b) ?? '') || compareTasks(a, b));
  return waiting[0] ?? null;
}
