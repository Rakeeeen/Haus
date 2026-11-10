import { useMemo, useState } from 'react';
import { useGuests } from '@/data/useMembers';
import { useWork } from '@/data/useWork';
import { assignableIn, OWNER_KEY } from '@/domain/work/sharing';
import { moveToStatus } from '@/domain/work/tasks';
import type { Task } from '@/domain/work/types';
import type { PersonOf } from '@/features/work/components/TaskBoard';
import { TaskModal, type Assignee, type TaskEditing } from '@/features/work/components/TaskModal';

/**
 * The task editor and what feeds it, for any screen that opens tasks: who the task can be for (Hamed's list of guests),
 * what this person may change (Hamed anything; a guest the tasks that are theirs), and how a save is written.
 * Returns the opener and the modal to put on the page.
 */
export function useTaskEditor(author: string, authorPhoto: string | null = null) {
  const { role, guestUid, projects, tasks, canEditTask, canDeleteTask, isProjectAdmin, addTask, updateTask, removeTask } = useWork();
  const [editing, setEditing] = useState<TaskEditing | null>(null);
  const { guests } = useGuests(role === 'owner');

  const assignees = useMemo<Assignee[]>(
    () => (role === 'owner'
      ? [{ key: OWNER_KEY, name: author, photoUrl: authorPhoto }, ...guests.filter((g) => g.uid && g.active).map((g) => ({ key: g.uid as string, name: g.name || g.email, photoUrl: g.photoUrl ?? null }))]
      : []),
    [role, guests, author, authorPhoto],
  );

  /** Who a task in `projectId` can be for: Hamed's list; for a guest who runs the project, its members and Hamed by the names the project carries. */
  const assigneesFor = (projectId: string | undefined): Assignee[] => {
    if (role === 'owner') return assignees;
    const project = projectId && isProjectAdmin(projectId) ? projects.find((p) => p.id === projectId) : null;
    if (!project) return [];
    return assignableIn(project).flatMap((key) => {
      const named = project.memberProfiles[key];
      return named ? [{ key, name: named.name, photoUrl: named.photoUrl }] : [];
    });
  };

  /** Everyone a task is for, with their photos, for the cards. A guest names the people their projects carry names for, and themself. */
  const personOf = useMemo<PersonOf>(() => {
    const byKey = new Map(assignees.map((a) => [a.key, a]));
    for (const project of projects) for (const [key, who] of Object.entries(project.memberProfiles)) if (!byKey.has(key)) byKey.set(key, { key, name: who.name, photoUrl: who.photoUrl });
    return (task: Task) => task.assigneeUids.flatMap((key) => {
      const known = byKey.get(key);
      if (known) return [{ name: known.name, photoUrl: known.photoUrl ?? null }];
      // A guest knows themself (and a task's first person by name), not the owner or the other guests.
      if (role !== 'owner' && key === guestUid) return [{ name: author, photoUrl: authorPhoto }];
      return [];
    });
  }, [assignees, projects, role, guestUid, author, authorPhoto]);

  /** What goes on a task for the people chosen: the list, and its first person the way older code reads it. */
  const who = (assigneeUids: string[], projectId?: string): Pick<Task, 'assigneeUids' | 'assigneeUid' | 'assignee'> => {
    const first = assigneesFor(projectId).find((a) => a.key === assigneeUids[0]);
    return { assigneeUids, assigneeUid: first && first.key !== OWNER_KEY ? first.key : null, assignee: first?.name ?? author };
  };

  const target = editing?.kind === 'edit' ? editing.task : null;
  const canEdit = target ? canEditTask(target) : true;
  const canDelete = target ? canDeleteTask(target) : false;

  const modal = (
    <TaskModal
      editing={editing}
      projects={projects}
      author={author}
      guestUid={guestUid ?? undefined}
      canEdit={canEdit}
      canDelete={canDelete}
      assigneesFor={assigneesFor}
      onClose={() => setEditing(null)}
      onCreate={async (draft) => { await addTask({ ...draft, ...who(draft.assigneeUids, draft.projectIds[0]), tags: [], doneAt: draft.status === 'done' ? new Date().toISOString() : null }); }}
      onUpdate={async (id, draft) => {
        const current = tasks.find((t) => t.id === id);
        await updateTask(id, { ...draft, ...who(draft.assigneeUids, draft.projectIds[0]), ...(current ? moveToStatus(current, draft.status) : {}) });
      }}
      onDelete={removeTask}
    />
  );

  return { open: setEditing, modal, personOf };
}
