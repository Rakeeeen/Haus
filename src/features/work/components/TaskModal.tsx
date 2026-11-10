import React, { useEffect, useState } from 'react';
import { AppModal } from '@/ui/AppModal';
import { Button } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { ChooseRow, Field, SelectMenu, SelectMulti, TextArea, TextInput } from '@/ui/Form';
import { clearDraft, loadDraft, saveDraft } from '@/lib/draftMemory';
import { PRIORITIES, TASK_STATUSES } from '@/domain/work/tasks';
import { OWNER_KEY } from '@/domain/work/sharing';
import type { Priority, Project, Task, TaskStatus } from '@/domain/work/types';
import { useComments } from '@/data/useWork';
import { PRIORITY_COLOR, shortDate } from '@/features/work/components/chips';

/** What the editor is for: an existing task, or a new one that starts with `defaults`. */
export type TaskEditing = { kind: 'edit'; task: Task } | { kind: 'new'; defaults: Partial<Task> };

type Draft = Pick<Task, 'title' | 'status' | 'priority' | 'date' | 'endDate' | 'projectIds' | 'assigneeUids' | 'description'>;

const DRAFT_KEY = 'work_task_draft';

const toDraft = (editing: TaskEditing): Draft => {
  const t: Partial<Task> = editing.kind === 'edit' ? editing.task : editing.defaults;
  return {
    title: t.title ?? '', status: t.status ?? 'todo', priority: t.priority ?? null, date: t.date ?? null, endDate: t.endDate ?? null,
    projectIds: t.projectIds?.length ? t.projectIds : t.projectId ? [t.projectId] : [], assigneeUids: t.assigneeUids?.length ? t.assigneeUids : [OWNER_KEY], description: t.description ?? '',
  };
};

/** Someone a task can be for: `key` is `OWNER_KEY` for Hamed, the guest's uid otherwise. */
export interface Assignee { key: string; name: string; photoUrl?: string | null }

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
  /**
   * Who a task in this project (undefined: none) can be for — Hamed first, then guests. For Hamed that is everyone he has invited; for a
   * guest it is the members of a project they run, and nobody elsewhere. Empty or one: the field is not shown.
   */
  assigneesFor: (projectId: string | undefined) => readonly Assignee[];
  onClose: () => void;
  onCreate: (draft: Draft) => Promise<void>;
  onUpdate: (id: string, draft: Draft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}> = ({ editing, projects, author, guestUid, canEdit, canDelete, assigneesFor, onClose, onCreate, onUpdate, onDelete }) => {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const taskId = editing?.kind === 'edit' ? editing.task.id : null;
  const { comments, add, remove } = useComments(taskId);

  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const fresh = editing ? toDraft(editing) : null;
    // A new task closed by accident (Escape, a click beside it) comes back as it was left, for a few minutes.
    const saved = editing?.kind === 'new' ? loadDraft<Draft>(DRAFT_KEY) : null;
    const keep = !!saved && !!(saved.title.trim() || saved.description.trim());
    setDraft(fresh && keep && saved ? { ...fresh, ...saved } : fresh);
    setRestored(keep);
    setSure(false);
    setError('');
    setComment('');
  }, [editing]);

  // Remembered as it is typed (a new task only).
  useEffect(() => {
    if (editing?.kind === 'new' && draft && (draft.title.trim() || draft.description.trim())) saveDraft(DRAFT_KEY, draft);
  }, [draft, editing]);

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
    // A task is always for someone: with nobody chosen it is Hamed's.
    if (draft.date && draft.endDate && draft.endDate < draft.date) { setError('The end is before the start'); return; }
    run(async () => {
      const body = { ...draft, title: draft.title.trim(), assigneeUids: draft.assigneeUids.length ? draft.assigneeUids : [OWNER_KEY] };
      if (editing.kind === 'edit') await onUpdate(editing.task.id, body); else await onCreate(body);
      clearDraft(DRAFT_KEY);
      onClose();
    });
  };

  const sendComment = () => run(async () => { await add(author, comment, guestUid, draft?.title ?? ""); setComment(''); });

  // For a task in projects, who it can be for is those projects' members (and Hamed); outside any project, any guest.
  const assignees = assigneesFor(draft?.projectIds[0]);
  const memberUids = projects.filter((p) => draft?.projectIds.includes(p.id)).flatMap((p) => p.memberUids);
  const choices = assignees.filter((a) => a.key === OWNER_KEY || !draft?.projectIds.length || memberUids.includes(a.key));
  const projectOptions = [...projects].sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ value: p.id, label: p.name }));
  const locked = !canEdit;

  return (
    <AppModal isOpen={editing !== null} onClose={onClose} title={editing?.kind === 'edit' ? `Task #${editing.task.no}` : 'New task'} maxWidth="max-w-2xl">
      {draft && editing && (
        <div className="flex flex-col gap-5 max-h-[72vh] overflow-y-auto pr-1">
          {restored && (
            <div className="flex items-center justify-between gap-3 rounded-box bg-ink/5 px-4 py-2.5 font-mono-main text-[13px] text-ink/60">
              <span>Picked up where you left off.</span>
              <Button tone="ghost" size="sm" onClick={() => { clearDraft(DRAFT_KEY); setRestored(false); setDraft(editing ? toDraft(editing) : null); }}>Start over</Button>
            </div>
          )}
          <Field label="Title">
            <TextInput dir="auto" disabled={locked} autoFocus={editing.kind === 'new'} value={draft.title} onChange={(e) => set('title', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); }} placeholder="What needs doing?" />
          </Field>

          <Field label="Status"><ChooseRow<TaskStatus> options={TASK_STATUSES} value={draft.status} disabled={locked} onChange={(v) => set('status', v)} /></Field>

          <Field label="Priority">
            <ChooseRow<Priority | 'none'>
              options={[...PRIORITIES, { value: 'none', label: 'None' }]}
              value={draft.priority ?? 'none'}
              disabled={locked}
              colors={PRIORITY_COLOR}
              onChange={(v) => set('priority', v === 'none' ? null : v)}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Start"><DatePicker flow ariaLabel="Start" disabled={locked} value={draft.date} onChange={(d) => set('date', d)} /></Field>
            <Field label="End"><DatePicker flow ariaLabel="End" disabled={locked} value={draft.endDate} onChange={(d) => set('endDate', d)} /></Field>
            <Field label={guestUid !== undefined ? 'Project' : 'Projects'}>
              {guestUid !== undefined ? (
                // A guest's task is in one project (the rules allow no more), and can't be moved once made.
                <SelectMenu
                  ariaLabel="Project"
                  value={draft.projectIds[0] ?? ''}
                  disabled={locked || editing.kind === 'edit'}
                  onChange={(v) => set('projectIds', v ? [v] : [])}
                  options={[{ value: '', label: 'No project' }, ...projectOptions]}
                />
              ) : (
                <SelectMulti
                  ariaLabel="Projects"
                  empty="No project"
                  values={draft.projectIds}
                  disabled={locked}
                  onChange={(v) => set('projectIds', v)}
                  options={projectOptions}
                />
              )}
            </Field>
            {assignees.length > 1 ? (
              <Field label="For">
                <SelectMulti
                  ariaLabel="For"
                  empty="Hamed"
                  values={draft.assigneeUids}
                  disabled={locked}
                  onChange={(v) => set('assigneeUids', v)}
                  options={choices.map((a) => ({ value: a.key, label: a.name, photoUrl: a.photoUrl, withAvatar: true }))}
                />
              </Field>
            ) : guestUid !== undefined && (
              // A guest who does not run this project gives a task to nobody: the field stays, greyed, showing whose it is.
              <Field label="For">
                <SelectMulti
                  ariaLabel="For"
                  empty={author}
                  values={[]}
                  disabled
                  onChange={() => {}}
                  options={[{ value: guestUid, label: author, photoUrl: null, withAvatar: true }]}
                />
              </Field>
            )}
          </div>

          <Field label="Description"><TextArea dir="auto" disabled={locked} value={draft.description} onChange={(e) => set('description', e.target.value)} placeholder="Details, links, notes…" /></Field>

          {editing.kind === 'edit' && (
            <div>
              <p className="font-sans-main uppercase tracking-widest mb-3 text-[12px] font-semibold text-ink/40">Comments</p>
              <div className="flex flex-col gap-3 mb-3">
                {comments.length === 0 && <p className="font-mono-main text-[12px] text-ink/30">No comments yet.</p>}
                {comments.map((c) => (
                  <div key={c.id} className="rounded-box bg-ink/5 px-4 py-3">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="font-mono-main text-[11px] uppercase tracking-widest text-ink/45">{c.author} · {shortDate(c.at.slice(0, 10))}</span>
                      <button onClick={() => remove(c.id)} className="font-mono-main text-[11px] uppercase tracking-widest text-ink/30 hover:text-rust transition-colors">Delete</button>
                    </div>
                    <p dir="auto" className="font-mono-main text-[14px] leading-relaxed whitespace-pre-wrap">{c.text}</p>
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

          {error && <p className="font-mono-main text-[12px] text-rust">{error}</p>}

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
