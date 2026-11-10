import React, { useEffect, useState } from 'react';
import { AppModal } from '@/ui/AppModal';
import { Button } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { Field, SelectMenu, TextArea, TextInput } from '@/ui/Form';
import { PRIORITIES, TASK_STATUSES } from '@/domain/work/tasks';
import type { Priority, Project, Task, TaskStatus } from '@/domain/work/types';
import { useComments } from '@/data/useWork';
import { PRIORITY_COLOR, shortDate } from '@/features/work/components/chips';

/** What the editor is for: an existing task, or a new one that starts with `defaults`. */
export type TaskEditing = { kind: 'edit'; task: Task } | { kind: 'new'; defaults: Partial<Task> };

type Draft = Pick<Task, 'title' | 'status' | 'priority' | 'date' | 'projectId' | 'assignee' | 'assigneeUid' | 'description'>;

const toDraft = (editing: TaskEditing): Draft => {
  const t: Partial<Task> = editing.kind === 'edit' ? editing.task : editing.defaults;
  return {
    title: t.title ?? '', status: t.status ?? 'todo', priority: t.priority ?? null, date: t.date ?? null,
    projectId: t.projectId ?? null, assignee: t.assignee ?? null, assigneeUid: t.assigneeUid ?? null, description: t.description ?? '',
  };
};

/** A row of buttons to pick one value from; they share space like every button row. */
function Choose<T extends string>({ options, value, onChange, disabled = false, colors }: {
  options: ReadonlyArray<{ value: T; label: string }>; colors?: Partial<Record<T, string>>; value: T; onChange: (value: T) => void; disabled?: boolean;
}) {
  return (
    <div className="spring-group flex flex-wrap gap-2">
      {options.map((o) => (
        <Button key={o.value} size="sm" tone={o.value === value ? 'ink' : 'outline'} disabled={disabled} onClick={() => onChange(o.value)}
          className={o.value === value ? colors?.[o.value] ?? '' : ''}>{o.label}</Button>
      ))}
    </div>
  );
}

export interface Assignee { uid: string | null; name: string; photoUrl?: string | null }

export const TaskModal: React.FC<{
  editing: TaskEditing | null;
  projects: readonly Project[];
  /** Who is commenting. */
  author: string;
  /** A guest's own uid: it goes on their comments, and the fields they may not change are locked. */
  guestUid?: string;
  /** May this person change the task (a guest, only their own)? A task they can't change is read, and commented on. */
  canEdit: boolean;
  canDelete: boolean;
  /** Who a task can be for: Hamed first, then guests (empty or one: the field is not shown). */
  assignees: readonly Assignee[];
  onClose: () => void;
  onCreate: (draft: Draft) => Promise<void>;
  onUpdate: (id: string, draft: Draft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}> = ({ editing, projects, author, guestUid, canEdit, canDelete, assignees, onClose, onCreate, onUpdate, onDelete }) => {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const taskId = editing?.kind === 'edit' ? editing.task.id : null;
  const { comments, add, remove } = useComments(taskId);

  useEffect(() => {
    setDraft(editing ? toDraft(editing) : null);
    setSure(false);
    setError('');
    setComment('');
  }, [editing]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try { await job(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false); return; }
    setBusy(false);
  };

  const save = () => {
    if (!draft || !editing) return;
    if (!draft.title.trim()) { setError('Give the task a title'); return; }
    run(async () => {
      const body = { ...draft, title: draft.title.trim() };
      if (editing.kind === 'edit') await onUpdate(editing.task.id, body); else await onCreate(body);
      onClose();
    });
  };

  const sendComment = () => run(async () => { await add(author, comment, guestUid); setComment(''); });

  // For a task in a project, who it can be for is that project's members; otherwise any guest.
  const memberUids = projects.find((p) => p.id === draft?.projectId)?.memberUids;
  const choices = assignees.filter((a) => a.uid === null || !draft?.projectId || (memberUids ?? []).includes(a.uid));
  const locked = !canEdit;

  return (
    <AppModal isOpen={editing !== null} onClose={onClose} title={editing?.kind === 'edit' ? `Task #${editing.task.no}` : 'New task'} maxWidth="max-w-2xl">
      {draft && editing && (
        <div className="flex flex-col gap-5 max-h-[72vh] overflow-y-auto pr-1">
          <Field label="Title">
            <TextInput dir="auto" disabled={locked} autoFocus={editing.kind === 'new'} value={draft.title} onChange={(e) => set('title', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); }} placeholder="What needs doing?" />
          </Field>

          <Field label="Status"><Choose<TaskStatus> options={TASK_STATUSES} value={draft.status} disabled={locked} onChange={(v) => set('status', v)} /></Field>

          <Field label="Priority">
            <Choose<Priority | 'none'>
              options={[...PRIORITIES, { value: 'none', label: 'None' }]}
              value={draft.priority ?? 'none'}
              disabled={locked}
              colors={PRIORITY_COLOR}
              onChange={(v) => set('priority', v === 'none' ? null : v)}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Date"><DatePicker flow ariaLabel="Date" disabled={locked} value={draft.date} onChange={(d) => set('date', d)} /></Field>
            <Field label="Project">
              <SelectMenu
                ariaLabel="Project"
                value={draft.projectId ?? ''}
                disabled={locked || (guestUid !== undefined && editing.kind === 'edit')}
                onChange={(v) => set('projectId', v || null)}
                options={[{ value: '', label: 'No project' }, ...[...projects].sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ value: p.id, label: p.name }))]}
              />
            </Field>
            {assignees.length > 1 && guestUid === undefined && (
              <Field label="For">
                <SelectMenu
                  ariaLabel="For"
                  value={draft.assigneeUid ?? ''}
                  disabled={locked}
                  onChange={(v) => {
                    const picked = assignees.find((a) => (a.uid ?? '') === v);
                    setDraft((d) => (d ? { ...d, assigneeUid: picked?.uid ?? null, assignee: picked?.name ?? null } : d));
                  }}
                  options={choices.map((a) => ({ value: a.uid ?? '', label: a.name, photoUrl: a.photoUrl, withAvatar: true }))}
                />
              </Field>
            )}
          </div>

          <Field label="Description"><TextArea dir="auto" disabled={locked} value={draft.description} onChange={(e) => set('description', e.target.value)} placeholder="Details, links, notes…" /></Field>

          {editing.kind === 'edit' && (
            <div>
              <p className="font-sans-main uppercase tracking-widest mb-3 text-[10px] font-semibold text-ink/40">Comments</p>
              <div className="flex flex-col gap-3 mb-3">
                {comments.length === 0 && <p className="font-mono-main text-[10px] text-ink/30">No comments yet.</p>}
                {comments.map((c) => (
                  <div key={c.id} className="rounded-box bg-ink/5 px-4 py-3">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="font-mono-main text-[9px] uppercase tracking-widest text-ink/45">{c.author} · {shortDate(c.at.slice(0, 10))}</span>
                      <button onClick={() => remove(c.id)} className="font-mono-main text-[9px] uppercase tracking-widest text-ink/30 hover:text-rust transition-colors">Delete</button>
                    </div>
                    <p dir="auto" className="font-mono-main text-[12px] leading-relaxed whitespace-pre-wrap">{c.text}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <TextInput dir="auto" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…"
                  onKeyDown={(e) => { if (e.key === 'Enter' && comment.trim()) sendComment(); }} />
                <Button tone="outline" disabled={busy || !comment.trim()} onClick={sendComment}>Post</Button>
              </div>
            </div>
          )}

          {error && <p className="font-mono-main text-[10px] text-rust">{error}</p>}

          <div className="spring-group flex gap-3 justify-end pt-2">
            {editing.kind === 'edit' && canDelete && (
              <Button tone="danger" disabled={busy}
                onClick={() => (sure ? run(async () => { await onDelete(editing.task.id); onClose(); }) : setSure(true))}>
                {sure ? 'Sure? Delete' : 'Delete'}
              </Button>
            )}
            {canEdit && <Button tone="primary" disabled={busy} onClick={save}>{editing.kind === 'edit' ? 'Save' : 'Add task'}</Button>}
          </div>
        </div>
      )}
    </AppModal>
  );
};
