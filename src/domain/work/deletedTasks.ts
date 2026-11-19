import type { Task } from '@/domain/work/types';

/** A task that was deleted, as it was, and when — kept on this device so ⌘Z can bring it back. */
export interface DeletedEntry { task: Task; at: number }

/** How many deleted tasks are kept, and for how long. */
export const MAX_KEPT = 30;
export const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

/** `list` with `task` added as the most recent (it replaces an older copy of itself), oldest ones dropped past the limit. */
export function remember(list: readonly DeletedEntry[], task: Task, now: number = Date.now()): DeletedEntry[] {
  return [{ task, at: now }, ...list.filter((e) => e.task.id !== task.id)].slice(0, MAX_KEPT);
}

/** `list` without the task `id`. */
export const forget = (list: readonly DeletedEntry[], id: string): DeletedEntry[] => list.filter((e) => e.task.id !== id);

/** What can still be brought back, the most recently deleted first. */
export const restorable = (list: readonly DeletedEntry[], now: number = Date.now()): DeletedEntry[] =>
  [...list].filter((e) => now - e.at <= KEEP_MS).sort((a, b) => b.at - a.at);

/** A stored value that is a usable list. */
export const isDeletedList = (value: unknown): value is DeletedEntry[] =>
  Array.isArray(value) && value.every((e) => !!e && typeof e.at === 'number' && !!e.task && typeof e.task.id === 'string' && typeof e.task.title === 'string');

/**
 * What to create to bring `task` back: the same task, new — it gets a new id (the old one is marked deleted for the devices that read
 * tasks by their changes, and a marker can't be taken away) and a new running number, and counts as changed just now so every device
 * picks it up.
 */
export function asNewTask(task: Task, now: Date = new Date()): Partial<Omit<Task, 'id' | 'no'>> & { title: string } {
  const { id: _id, no: _no, ...rest } = task;
  return { ...rest, updatedAt: now.toISOString() };
}
