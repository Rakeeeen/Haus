import type { Project, Task } from '@/domain/work/types';

/**
 * Who sees what, when projects are shared with guests. Hamed sees everything (firestore.rules says so by his uid); a
 * guest sees a project they are a member of, and its tasks as the project's `guestsSeeAll` decides: every task of it,
 * or only the ones that are theirs. A task outside any project is seen by whoever it is for and whoever made it.
 */
const unique = (uids: ReadonlyArray<string | null | undefined>): string[] => [...new Set(uids.filter((u): u is string => !!u))];

/** The guests who may see `task`, given its project (null if it has none). Written onto the task for the rules. */
export function viewersOf(
  task: Pick<Task, 'assigneeUid' | 'createdByUid'>,
  project: Pick<Project, 'memberUids' | 'guestsSeeAll'> | null,
): string[] {
  const own = unique([task.assigneeUid, task.createdByUid]);
  if (!project) return own;
  return project.guestsSeeAll ? unique(project.memberUids) : own.filter((uid) => project.memberUids.includes(uid));
}

/** A guest may change a task that is theirs: it is for them, or they made it. */
export const isMineAsGuest = (task: Pick<Task, 'assigneeUid' | 'createdByUid'>, uid: string): boolean =>
  task.assigneeUid === uid || task.createdByUid === uid;

/** A project's tasks with `viewerUids` that are out of date after the project's sharing changed. */
export function staleViewers(tasks: readonly Task[], project: Pick<Project, 'memberUids' | 'guestsSeeAll'>): Array<{ id: string; viewerUids: string[] }> {
  return tasks
    .map((task) => ({ id: task.id, viewerUids: viewersOf(task, project) }))
    .filter((next, i) => {
      const now = [...tasks[i].viewerUids].sort().join('|');
      return now !== [...next.viewerUids].sort().join('|');
    });
}

/** Tasks and projects as Firestore holds them can be older than the shapes (the Notion import wrote none of the sharing fields). */
export function normalizeTask(raw: Partial<Task> & { id: string }): Task {
  return {
    no: 0, title: '', status: 'todo', priority: null, date: null, projectId: null, assignee: null,
    assigneeUid: null, createdByUid: null, viewerUids: [], tags: [], description: '', createdAt: '', updatedAt: '', doneAt: null,
    ...raw,
  };
}

export function normalizeProject(raw: Partial<Project> & { id: string }): Project {
  return {
    name: '', status: 'active', priority: null, lead: null, date: null, memberUids: [], guestsSeeAll: false, createdAt: '', updatedAt: '',
    ...raw,
  };
}
