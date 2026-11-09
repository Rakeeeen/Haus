import type { Priority, Task, TaskStatus } from '@/domain/work/types';

export const TASK_STATUSES: ReadonlyArray<{ value: TaskStatus; label: string }> = [
  { value: 'todo', label: 'To do' },
  { value: 'doing', label: 'Doing' },
  { value: 'done', label: 'Done' },
  { value: 'dropped', label: 'Dropped' },
];

export const PRIORITIES: ReadonlyArray<{ value: Priority; label: string }> = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export const statusLabel = (status: TaskStatus) => TASK_STATUSES.find((s) => s.value === status)?.label ?? status;

/** A date as "YYYY-MM-DD", in the device's own day (the one Notion's "Today" follows too). */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A "YYYY-MM-DD" back to a date at local midnight. */
export function parseDayKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export const addDays = (key: string, days: number): string => {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + days);
  return dayKey(d);
};

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export const daysBetween = (from: string, to: string): number =>
  Math.round((parseDayKey(to).getTime() - parseDayKey(from).getTime()) / 86_400_000);

/** Still to be done: not finished and not dropped. */
export const isOpen = (task: Task): boolean => task.status === 'todo' || task.status === 'doing';

/** Open and dated before `today`. */
export const isOverdue = (task: Task, today: string): boolean => isOpen(task) && task.date !== null && task.date < today;

/** High first, then the sooner date, then the older task. Undated tasks come after dated ones. */
export function compareTasks(a: Task, b: Task): number {
  const byPriority = (a.priority ? PRIORITY_RANK[a.priority] : 3) - (b.priority ? PRIORITY_RANK[b.priority] : 3);
  if (byPriority) return byPriority;
  if (a.date !== b.date) {
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return a.date < b.date ? -1 : 1;
  }
  return a.no - b.no;
}

export const sortTasks = (tasks: readonly Task[]): Task[] => [...tasks].sort(compareTasks);

/** The tasks of each status, in order, ready for the board's columns. */
export function groupByStatus(tasks: readonly Task[]): Record<TaskStatus, Task[]> {
  const groups: Record<TaskStatus, Task[]> = { todo: [], doing: [], done: [], dropped: [] };
  for (const task of sortTasks(tasks)) groups[task.status].push(task);
  return groups;
}

/**
 * What a task becomes when it is moved to `status` (dragged to another column, say): the status, when it
 * was last changed, and when it was finished — cleared again if it is reopened.
 */
export function moveToStatus(task: Task, status: TaskStatus, now: Date = new Date()): Pick<Task, 'status' | 'doneAt' | 'updatedAt'> {
  const at = now.toISOString();
  return {
    status,
    updatedAt: at,
    doneAt: status === 'done' ? (task.status === 'done' ? task.doneAt : at) : null,
  };
}

export type DayFilter =
  | { kind: 'all' }
  /** Follows the real date: yesterday's "today" is not today's. */
  | { kind: 'today' }
  | { kind: 'day'; day: string }
  | { kind: 'overdue' }
  | { kind: 'undated' };

export interface TaskFilter {
  day: DayFilter;
  /** Statuses to keep; empty keeps all. */
  statuses?: readonly TaskStatus[];
  projectId?: string | 'none';
  assignee?: string;
  query?: string;
}

/** The tasks matching `filter`, `now` deciding what "today" is. */
export function filterTasks(tasks: readonly Task[], filter: TaskFilter, now: Date = new Date()): Task[] {
  const today = dayKey(now);
  const query = filter.query?.trim().toLowerCase();
  return tasks.filter((task) => {
    switch (filter.day.kind) {
      case 'today': if (task.date !== today) return false; break;
      case 'day': if (task.date !== filter.day.day) return false; break;
      case 'overdue': if (!isOverdue(task, today)) return false; break;
      case 'undated': if (task.date !== null) return false; break;
      case 'all': break;
    }
    if (filter.statuses?.length && !filter.statuses.includes(task.status)) return false;
    if (filter.projectId === 'none' ? task.projectId !== null : filter.projectId && task.projectId !== filter.projectId) return false;
    if (filter.assignee && task.assignee !== filter.assignee) return false;
    if (query && !task.title.toLowerCase().includes(query)) return false;
    return true;
  });
}

export const nextTaskNo = (tasks: readonly Task[]): number => tasks.reduce((max, t) => Math.max(max, t.no), 0) + 1;

/** A blank task for the editor, dated `day`. */
export function blankTask(no: number, day: string | null, now: Date = new Date()): Omit<Task, 'id'> {
  const at = now.toISOString();
  return {
    no, title: '', status: 'todo', priority: null, date: day, projectId: null, assignee: null,
    tags: [], description: '', createdAt: at, updatedAt: at, doneAt: null,
  };
}

export interface CalendarDay { key: string; inMonth: boolean }

/**
 * The weeks of a month for a calendar, Saturday first (the week here starts on Saturday), padded with the
 * neighbouring months' days so every week has seven. `month` is 0–11.
 */
export function monthGrid(year: number, month: number): CalendarDay[][] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 1) % 7; // Sat = 0 … Fri = 6
  const start = new Date(year, month, 1 - lead);
  const weeks: CalendarDay[][] = [];
  const cursor = new Date(start);
  do {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ key: dayKey(cursor), inMonth: cursor.getMonth() === month });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  } while (cursor.getMonth() === month);
  return weeks;
}
