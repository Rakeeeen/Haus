import { addDays, daysBetween, parseDayKey, dayKey } from '@/domain/work/tasks';
import type { Priority, Project, ProjectStatus, Task } from '@/domain/work/types';

export const PROJECT_STATUSES: ReadonlyArray<{ value: ProjectStatus; label: string }> = [
  { value: 'active', label: 'In progress' },
  { value: 'planning', label: 'Planning' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'paused', label: 'On hold' },
  { value: 'done', label: 'Done' },
];

export const projectStatusLabel = (status: ProjectStatus) => PROJECT_STATUSES.find((s) => s.value === status)?.label ?? status;

/** The projects whose status is one of `statuses`; none chosen keeps them all. */
export const filterProjectsByStatus = (projects: readonly Project[], statuses: readonly ProjectStatus[]): Project[] =>
  (statuses.length === 0 ? [...projects] : projects.filter((p) => statuses.includes(p.status)));

/** The projects being worked on: in progress, or looked after (maintenance). */
export const isWorkedOn = (project: Project): boolean => project.status === 'active' || project.status === 'maintenance';

/**
 * How much of a project is done, 0–1: finished tasks over all its tasks, leaving out the ones dropped.
 * A project with no tasks yet is at 0.
 */
export function progressOf(tasks: readonly Task[]): number {
  const counted = tasks.filter((t) => t.status !== 'dropped');
  if (counted.length === 0) return 0;
  return counted.filter((t) => t.status === 'done').length / counted.length;
}

export interface ProjectTaskCounts { total: number; done: number; open: number }

export function countTasks(tasks: readonly Task[]): ProjectTaskCounts {
  const counted = tasks.filter((t) => t.status !== 'dropped');
  const done = counted.filter((t) => t.status === 'done').length;
  return { total: counted.length, done, open: counted.length - done };
}

/** Tasks grouped by their project's id (tasks with no project are left out). */
export function tasksByProject(tasks: readonly Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.projectId) continue;
    const list = map.get(task.projectId);
    if (list) list.push(task); else map.set(task.projectId, [task]);
  }
  return map;
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/** Newest first, with the more important ahead among the same days. */
export function compareProjects(a: Project, b: Project): number {
  if (a.date !== b.date) {
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return a.date < b.date ? 1 : -1;
  }
  return (a.priority ? PRIORITY_RANK[a.priority] : 3) - (b.priority ? PRIORITY_RANK[b.priority] : 3);
}

export type ProjectGroupKey = 'status' | 'client';

/** The projects in labelled groups, for the table (by status) and the cards (by client). Empty groups are dropped. */
export function groupProjects(
  projects: readonly Project[],
  by: ProjectGroupKey,
  clientOf: (projectId: string) => string | null,
): Array<{ key: string; label: string; projects: Project[] }> {
  const groups = new Map<string, Project[]>();
  for (const project of [...projects].sort(compareProjects)) {
    const key = by === 'status' ? project.status : clientOf(project.id) ?? '';
    const list = groups.get(key);
    if (list) list.push(project); else groups.set(key, [project]);
  }
  const order = PROJECT_STATUSES.map((s) => s.value as string);
  return [...groups.entries()]
    .sort(([a], [b]) => (by === 'status' ? order.indexOf(a) - order.indexOf(b) : a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
    .map(([key, list]) => ({
      key,
      label: by === 'status' ? projectStatusLabel(key as ProjectStatus) : key || 'No client',
      projects: list,
    }));
}

/** The first and last day among the projects' dates ("YYYY-MM-DD"), or null if none is dated. */
export function dateSpan(projects: readonly Project[]): { from: string; to: string } | null {
  const dates = projects.map((p) => p.date).filter((d): d is string => d !== null).sort();
  return dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null;
}

export interface DaySpan { from: string; to: string }

/** A project shown for at least this long on the timeline, so a single-day project is still a bar. */
export const MIN_SPAN_DAYS = 7;

/**
 * The days a project covers on the timeline: from its own date (or its first task's) to its last task, and up to
 * today while it is being worked on.
 */
export function projectSpan(project: Project, tasks: readonly Task[], today: string): DaySpan {
  const dated = tasks.map((t) => t.date).filter((d): d is string => d !== null).sort();
  const from = project.date ?? dated[0] ?? today;
  let to = dated.length ? dated[dated.length - 1] : from;
  if (isWorkedOn(project) && to < today) to = today;
  if (to < from) to = from;
  if (daysBetween(from, to) < MIN_SPAN_DAYS) to = addDays(from, MIN_SPAN_DAYS);
  return { from, to };
}

/** The first of each month from `from`'s month to `to`'s, with how many days in from the start — for the timeline's header. */
export function monthStarts(from: string, to: string): Array<{ key: string; label: string; offset: number }> {
  const start = parseDayKey(from);
  const end = parseDayKey(to);
  const out: Array<{ key: string; label: string; offset: number }> = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const key = dayKey(cursor);
    out.push({
      key,
      label: cursor.toLocaleDateString('en-GB', { month: 'short', ...(cursor.getMonth() === 0 || out.length === 0 ? { year: '2-digit' } : {}) }),
      offset: daysBetween(from, key),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}
