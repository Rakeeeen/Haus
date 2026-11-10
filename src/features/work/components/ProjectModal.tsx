import React, { useEffect, useState } from 'react';
import { AppModal } from '@/ui/AppModal';
import { Button } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { Field, SelectMenu, SelectMulti, TextInput } from '@/ui/Form';
import { clearDraft, loadDraft, saveDraft } from '@/lib/draftMemory';
import { PRIORITY_COLOR } from '@/features/work/components/chips';
import { PROJECT_STATUSES } from '@/domain/work/projects';
import { PRIORITIES } from '@/domain/work/tasks';
import type { Invitation } from '@/domain/access';
import type { Priority, Project, ProjectStatus } from '@/domain/work/types';

export type ProjectEditing = { kind: 'edit'; project: Project; client: string | null } | { kind: 'new'; client: string | null };

export interface ProjectDraft {
  name: string;
  status: ProjectStatus;
  priority: Priority | null;
  lead: string | null;
  date: string | null;
  endDate: string | null;
  client: string | null;
  /** The guests on the project, and whether they see everyone's tasks in it. */
  memberUids: string[];
  guestsSeeAll: boolean;
}

/** What the form starts with: the project being changed, or a new one (led by Hamed unless told otherwise). */
function draftOf(editing: ProjectEditing, ownerName: string): ProjectDraft {
  const p = editing.kind === 'edit' ? editing.project : null;
  return {
    name: p?.name ?? '', status: p?.status ?? 'active', priority: p?.priority ?? null,
    lead: p?.lead ?? ownerName, date: p?.date ?? null, endDate: p?.endDate ?? null, client: editing.client,
    memberUids: p?.memberUids ?? [], guestsSeeAll: p?.guestsSeeAll ?? false,
  };
}

const NEW = '__new__';
const DRAFT_KEY = 'work_project_draft';

function Choose<T extends string>({ options, value, onChange, colors }: {
  options: ReadonlyArray<{ value: T; label: string }>; colors?: Partial<Record<T, string>>; value: T; onChange: (value: T) => void;
}) {
  return (
    <div className="spring-group flex flex-wrap gap-2">
      {options.map((o) => (
        <Button key={o.value} size="sm" tone={o.value === value ? 'ink' : 'outline'} onClick={() => onChange(o.value)}
          className={o.value === value ? colors?.[o.value] ?? '' : ''}>{o.label}</Button>
      ))}
    </div>
  );
}

/** Making or changing a project. Who it is for (the client) is written to the owner-only record, never to the project. */
export const ProjectModal: React.FC<{
  editing: ProjectEditing | null;
  clients: readonly string[];
  /** The guests Hamed has invited; the ones who have signed in (so have a uid) can be put on a project. */
  guests: readonly Invitation[];
  /** Hamed himself, who can lead a project too. */
  owner: { name: string; photoUrl: string | null };
  onClose: () => void;
  onSave: (editing: ProjectEditing, draft: ProjectDraft) => Promise<void>;
  onDelete: (project: Project) => Promise<void>;
}> = ({ editing, clients, guests, owner, onClose, onSave, onDelete }) => {
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const [error, setError] = useState('');
  /** Typing the name of a client who is not in the list yet. */
  const [newClient, setNewClient] = useState(false);

  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!editing) { setDraft(null); return; }
    const fresh = draftOf(editing, owner.name);
    // A new project closed by accident comes back as it was left, for a few minutes.
    const saved = editing.kind === 'new' ? loadDraft<ProjectDraft>(DRAFT_KEY) : null;
    const keep = !!saved && !!saved.name.trim();
    setDraft(keep ? { ...fresh, ...saved } : fresh);
    setRestored(keep);
    setSure(false);
    setError('');
    setNewClient(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // Remembered as it is typed (a new project only).
  useEffect(() => {
    if (editing?.kind === 'new' && draft && (draft.name.trim() || draft.client)) saveDraft(DRAFT_KEY, draft);
  }, [draft, editing]);

  // Everyone who can lead a project: Hamed and the guests he has invited (a guest is on the list once they have signed in).
  const people = [{ name: owner.name, photoUrl: owner.photoUrl }, ...guests.map((g) => ({ name: g.name || g.email, photoUrl: g.photoUrl ?? null }))];
  const signedIn = guests.filter((g) => !!g.uid && g.active !== false);

  const set = <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try { await job(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };

  const save = () => {
    if (!draft || !editing) return;
    if (!draft.name.trim()) { setError('Give the project a name'); return; }
    if (draft.date && draft.endDate && draft.endDate < draft.date) { setError('The end is before the start'); return; }
    run(async () => { await onSave(editing, { ...draft, name: draft.name.trim() }); clearDraft(DRAFT_KEY); onClose(); });
  };

  return (
    <AppModal isOpen={editing !== null} onClose={onClose} title={editing?.kind === 'edit' ? 'Project' : 'New project'}>
      {draft && editing && (
        <div className="flex flex-col gap-5 max-h-[72vh] overflow-y-auto pr-1">
          {restored && (
            <div className="flex items-center justify-between gap-3 rounded-box bg-ink/5 px-4 py-2.5 font-mono-main text-[13px] text-ink/60">
              <span>Picked up where you left off.</span>
              <Button tone="ghost" size="sm" onClick={() => { clearDraft(DRAFT_KEY); setRestored(false); setDraft(draftOf(editing, owner.name)); }}>Start over</Button>
            </div>
          )}
          <Field label="Name">
            <TextInput dir="auto" autoFocus={editing.kind === 'new'} value={draft.name} onChange={(e) => set('name', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
          </Field>
          <Field label="Status"><Choose<ProjectStatus> options={PROJECT_STATUSES} value={draft.status} onChange={(v) => set('status', v)} /></Field>
          <Field label="Priority">
            <Choose<Priority | 'none'> options={[...PRIORITIES, { value: 'none', label: 'None' }]} colors={PRIORITY_COLOR} value={draft.priority ?? 'none'} onChange={(v) => set('priority', v === 'none' ? null : v)} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Client">
              <SelectMenu
                ariaLabel="Client"
                value={newClient ? NEW : draft.client ?? ''}
                onChange={(v) => { if (v === NEW) { setNewClient(true); set('client', null); } else { setNewClient(false); set('client', v || null); } }}
                options={[{ value: '', label: 'No client' }, ...clients.map((c) => ({ value: c, label: c })), ...(draft.client && !clients.includes(draft.client) && !newClient ? [{ value: draft.client, label: draft.client }] : []), { value: NEW, label: '+ New client…' }]}
              />
              {newClient && <TextInput dir="auto" autoFocus className="mt-2" value={draft.client ?? ''} onChange={(e) => set('client', e.target.value || null)} placeholder="The new client's name" />}
            </Field>
            <Field label="Lead">
              <SelectMenu
                ariaLabel="Lead"
                value={draft.lead ?? ''}
                onChange={(v) => set('lead', v || null)}
                options={[
                  { value: '', label: 'No lead' },
                  ...people.map((p) => ({ value: p.name, label: p.name, photoUrl: p.photoUrl, withAvatar: true })),
                  ...(draft.lead && !people.some((p) => p.name === draft.lead) ? [{ value: draft.lead, label: draft.lead, withAvatar: true }] : []),
                ]}
              />
            </Field>
            <Field label="Start"><DatePicker flow ariaLabel="Start" value={draft.date} onChange={(d) => set('date', d)} /></Field>
            <Field label="End"><DatePicker flow ariaLabel="End" value={draft.endDate} onChange={(d) => set('endDate', d)} /></Field>
          </div>

          <Field label="Guests on this project">
            {guests.length === 0 ? (
              <p className="font-mono-main text-[12px] text-ink/40">Invite someone from the Guests list on Home first.</p>
            ) : (
              <div className="flex flex-col gap-3">
                <SelectMulti
                  ariaLabel="Guests on this project"
                  empty="Nobody"
                  values={draft.memberUids}
                  onChange={(v) => set('memberUids', v)}
                  options={signedIn.map((g) => ({ value: g.uid as string, label: g.name || g.email, photoUrl: g.photoUrl, withAvatar: true }))}
                />
                <div className="spring-group flex gap-2">
                  <Button size="sm" tone={draft.guestsSeeAll ? 'outline' : 'ink'} onClick={() => set('guestsSeeAll', false)}>Only their own tasks</Button>
                  <Button size="sm" tone={draft.guestsSeeAll ? 'ink' : 'outline'} onClick={() => set('guestsSeeAll', true)}>Everyone's tasks</Button>
                </div>
              </div>
            )}
          </Field>
          {error && <p className="font-mono-main text-[12px] text-rust">{error}</p>}
          <div className="spring-group flex gap-3 justify-end pt-2">
            {editing.kind === 'edit' && (
              <Button tone="danger" disabled={busy}
                onClick={() => (sure ? run(async () => { await onDelete(editing.project); onClose(); }) : setSure(true))}>
                {sure ? 'Sure? Delete' : 'Delete'}
              </Button>
            )}
            <Button disabled={busy} onClick={save}>{editing.kind === 'edit' ? 'Save' : 'Add project'}</Button>
          </div>
        </div>
      )}
    </AppModal>
  );
};
