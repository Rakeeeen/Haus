import type { Project, Task } from '@/domain/work/types';

/**
 * Who sees what, when projects are shared with guests. Hamed sees everything (firestore.rules says so by his uid); a
 * guest sees a project they are a member of, and its tasks as the project's `guestsSeeAll` decides: every task of it,
 * or only the ones that are theirs. A task outside any project is seen by whoever it is for and whoever made it.
 */
/** How Hamed stands in a task's `assigneeUids` (he has no guest uid). */
export const OWNER_KEY = 'owner';

const unique = (uids: ReadonlyArray<string | null | undefined>): string[] => [...new Set(uids.filter((u): u is string => !!u))];

type Sharing = Pick<Project, 'memberUids' | 'guestsSeeAll'> & Partial<Pick<Project, 'adminUids'>>;

/**
 * The guests who may see `task`, given the projects it is in (none: the task is outside any project). Written onto the
 * task for the rules. A task in several projects is seen by the union of what each project allows, so a guest who is
 * on one of them sees it there — and only learns the names of the projects they are on (they can read no other).
 */
export function viewersOf(task: Pick<Task, 'assigneeUids' | 'createdByUid'>, projects: readonly Sharing[]): string[] {
  // Hamed needs no listing; the guests it is for, and the guest who made it, are its own people.
  const own = unique([...task.assigneeUids.filter((u) => u !== OWNER_KEY), task.createdByUid]);
  if (projects.length === 0) return own;
  // A project's admins see all of its tasks, whoever they are for (they run it).
  return unique(projects.flatMap((project) => (project.guestsSeeAll
    ? project.memberUids
    : [...own.filter((uid) => project.memberUids.includes(uid)), ...(project.adminUids ?? [])])));
}

/** Whether `uid` runs `project` (is one of its admins). */
export const isAdminOf = (project: Pick<Project, 'adminUids'> | null | undefined, uid: string): boolean => !!project && project.adminUids.includes(uid);

/**
 * The project of `task` that `uid` runs, if they do: only a task in exactly one project counts (what a task in several
 * projects shows to whom is Hamed's to settle).
 */
export function adminProjectOf<P extends Pick<Project, 'id' | 'adminUids'>>(task: Pick<Task, 'projectIds'>, projects: readonly P[], uid: string): P | null {
  if (task.projectIds.length !== 1) return null;
  const project = projects.find((p) => p.id === task.projectIds[0]);
  return project && isAdminOf(project, uid) ? project : null;
}

/** Everyone a project's admin may give a task to: the members, and Hamed. */
export const assignableIn = (project: Pick<Project, 'memberUids'>): string[] => [OWNER_KEY, ...project.memberUids];

/** May this guest change this task: it is theirs, or they run its project. */
export const canEditAsGuest = (task: Pick<Task, 'assigneeUids' | 'createdByUid' | 'projectIds'>, uid: string, projects: readonly Pick<Project, 'id' | 'adminUids'>[]): boolean =>
  isMineAsGuest(task, uid) || adminProjectOf(task, projects, uid) !== null;

/** Whether `task` belongs to the project `projectId`. */
export const isInProject = (task: Pick<Task, 'projectIds'>, projectId: string): boolean => task.projectIds.includes(projectId);

/** A guest may change a task that is theirs: it is for them, or they made it. */
export const isMineAsGuest = (task: Pick<Task, 'assigneeUids' | 'createdByUid'>, uid: string): boolean =>
  task.assigneeUids.includes(uid) || task.createdByUid === uid;

/** Whether `task` is for the person `me` (`OWNER_KEY` for Hamed, a uid for a guest). */
export const isFor = (task: Pick<Task, 'assigneeUids'>, me: string): boolean => task.assigneeUids.includes(me);

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
    assigneeUid: null, assigneeUids: [], createdByUid: null, viewerUids: [], tags: [], description: '', createdAt: '', updatedAt: '', doneAt: null,
    ...raw,
  };
  // Older tasks (and a guest's, which the rules keep to one project) have only `projectId`.
  const projectIds = raw.projectIds && raw.projectIds.length ? raw.projectIds : task.projectId ? [task.projectId] : [];
  // Older tasks have one person (a guest's uid) or none, which meant Hamed.
  const assigneeUids = raw.assigneeUids && raw.assigneeUids.length ? raw.assigneeUids : task.assigneeUid ? [task.assigneeUid] : [OWNER_KEY];
  return { ...task, projectIds, projectId: projectIds[0] ?? null, assigneeUids };
}

export function normalizeProject(raw: Partial<Project> & { id: string }): Project {
  return {
    name: '', status: 'active', priority: null, lead: null, date: null, endDate: null, memberUids: [], guestsSeeAll: false, adminUids: [], memberProfiles: {}, createdAt: '', updatedAt: '',
    ...raw,
  };
}
