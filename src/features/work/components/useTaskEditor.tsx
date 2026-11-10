import { useMemo, useState } from 'react';
import { useGuests } from '@/data/useMembers';
import { useWork } from '@/data/useWork';
import { moveToStatus } from '@/domain/work/tasks';
import { TaskModal, type Assignee, type TaskEditing } from '@/features/work/components/TaskModal';

/**
 * The task editor and what feeds it, for any screen that opens tasks: who the task can be for (Hamed's list of guests),
 * what this person may change (Hamed anything; a guest the tasks that are theirs), and how a save is written.
 * Returns the opener and the modal to put on the page.
 */
export function useTaskEditor(author: string) {
  const { role, guestUid, projects, tasks, canEditTask, addTask, updateTask, removeTask } = useWork();
  const [editing, setEditing] = useState<TaskEditing | null>(null);
  const { guests } = useGuests(role === 'owner');

  const assignees = useMemo<Assignee[]>(
    () => (role === 'owner'
      ? [{ uid: null, name: author }, ...guests.filter((g) => g.uid && g.active).map((g) => ({ uid: g.uid as string, name: g.name || g.email }))]
      : []),
    [role, guests, author],
  );

  const target = editing?.kind === 'edit' ? editing.task : null;
  const canEdit = target ? canEditTask(target) : true;
  const canDelete = target ? role === 'owner' || target.createdByUid === guestUid : false;

  const modal = (
    <TaskModal
      editing={editing}
      projects={projects}
      author={author}
      guestUid={guestUid ?? undefined}
      canEdit={canEdit}
      canDelete={canDelete}
      assignees={assignees}
      onClose={() => setEditing(null)}
      onCreate={async (draft) => { await addTask({ ...draft, doneAt: draft.status === 'done' ? new Date().toISOString() : null }); }}
      onUpdate={async (id, draft) => {
        const current = tasks.find((t) => t.id === id);
        await updateTask(id, { ...draft, ...(current ? moveToStatus(current, draft.status) : {}) });
      }}
      onDelete={removeTask}
    />
  );

  return { open: setEditing, modal };
}
