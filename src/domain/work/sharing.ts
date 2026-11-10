import type { Project, Task } from '@/domain/work/types';

/**
 * Who sees what, when projects are shared with guests. Hamed sees everything (firestore.rules says so by his uid); a
 * guest sees a project they are a member of, and its tasks as the project's `guestsSeeAll` decides: every task of it,
 * or only the ones that are theirs. A task outside any project is seen by whoever it is for and whoever made it.
 */
const unique = (uids: ReadonlyArray<string | null | undefined>): string[] => [...new Set(uids.filter((u): u is string => !!u))];

type Sharing = Pick<Project, 'memberUids' | 'guestsSeeAll'>;

/**
 * The guests who may see `task`, given the projects it is in (none: the task is outside any project). Written onto the
 * task for the rules. A task in several projects is seen by the union of what each project allows, so a guest who is
 * on one of them sees it there — and only learns the names of the projects they are on (they can read no other).
 */
export function viewersOf(task: Pick<Task, 'assigneeUid' | 'createdByUid'>, projects: readonly Sharing[]): string[] {
  const own = unique([task.assigneeUid, task.createdByUid]);
  if (projects.length === 0) return own;
  return unique(projects.flatMap((project) => (project.guestsSeeAll ? project.memberUids : own.filter((uid) => project.memberUids.includes(uid)))));
}

/** Whether `task` belongs to the project `projectId`. */
export const isInProject = (task: Pick<Task, 'projectIds'>, projectId: string): boolean => task.projectIds.includes(projectId);

/** A guest may change a task that is theirs: it is for them, or they made it. */
export const isMineAsGuest = (task: Pick<Task, 'assigneeUid' | 'createdByUid'>, uid: string): boolean =>
  task.assigneeUid === uid || task.createdByUid === uid;

/**
 * A project's tasks with `viewerUids` that are out of date after the project's sharing changed. `others` are the
 * task's other projects (by id → sharing), since a task in two projects is seen by what both allow.
 */
export function staleViewers(
  tasks: readonly Task[],
  project: { id: string } & Sharing,
  sharingOf: (projectId: string) => Sharing | null = () => null,
): Array<{ id: string; viewerUids: string[] }> {
  return tasks
    .map((task) => ({
      id: task.id,
      viewerUids: viewersOf(task, task.projectIds.map((id) => (id === project.id ? project : sharingOf(id))).filter((s): s is Sharing => s !== null)),
    }))
    .filter((next, i) => {
      const now = [...tasks[i].viewerUids].sort().join('|');
      return now !== [...next.viewerUids].sort().join('|');
    });
}

/** Tasks and projects as Firestore holds them can be older than the shapes (the Notion import wrote none of the sharing fields). */
export function normalizeTask(raw: Partial<Task> & { id: string }): Task {
  const task: Task = {
    no: 0, title: '', status: 'todo', priority: null, date: null, endDate: null, projectId: null, projectIds: [], assignee: null,
    assigneeUid: null, createdByUid: null, viewerUids: [], tags: [], description: '', createdAt: '', updatedAt: '', doneAt: null,
    ...raw,
  };
  // Older tasks (and a guest's, which the rules keep to one project) have only `projectId`.
  const projectIds = raw.projectIds && raw.projectIds.length ? raw.projectIds : task.projectId ? [task.projectId] : [];
  return { ...task, projectIds, projectId: projectIds[0] ?? null };
}

export function normalizeProject(raw: Partial<Project> & { id: string }): Project {
  return {
    name: '', status: 'active', priority: null, lead: null, date: null, endDate: null, memberUids: [], guestsSeeAll: false, createdAt: '', updatedAt: '',
    ...raw,
  };
}
