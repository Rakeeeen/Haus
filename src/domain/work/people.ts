import { OWNER_KEY } from '@/domain/work/sharing';
import type { Project, Task } from '@/domain/work/types';

/** Someone a task is for, as a card shows them: a round photo (or their first letter). */
export interface Person { key: string; name: string; photoUrl: string | null }

/** Who is looking: Hamed (`OWNER_KEY`) or a guest by uid. They know themself even where no project carries their name. */
export interface Looker { key: string; name: string; photoUrl: string | null }

/**
 * The people a task is for, in the order the task lists them. A person is named by the looker's own profile when it is
 * them, else by what the task's projects carry (`memberProfiles` — a guest can't read the guest list, so Hamed's app writes
 * each member's name and photo onto the project). Someone no project names is left out rather than shown nameless.
 */
export function peopleOf(task: Pick<Task, 'assigneeUids' | 'projectIds'>, projects: readonly Pick<Project, 'id' | 'memberProfiles'>[], looker: Looker): Person[] {
  const inTask = projects.filter((p) => task.projectIds.includes(p.id));
  return task.assigneeUids.flatMap((key) => {
    if (key === looker.key) return [{ key, name: looker.name, photoUrl: looker.photoUrl }];
    for (const project of inTask) {
      const named = project.memberProfiles[key];
      if (named) return [{ key, name: named.name, photoUrl: named.photoUrl ?? null }];
    }
    return [];
  });
}

/** The key a viewer is known by in `assigneeUids`. */
export const lookerKey = (isOwner: boolean, guestUid: string | null): string => (isOwner ? OWNER_KEY : guestUid ?? '');
