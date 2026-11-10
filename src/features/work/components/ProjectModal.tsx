import React, { useEffect, useState } from 'react';
import { AppModal } from '@/ui/AppModal';
import { Button } from '@/ui/Button';
import { Field, TextInput } from '@/ui/Form';
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
  client: string | null;
  /** The guests on the project, and whether they see everyone's tasks in it. */
  memberUids: string[];
  guestsSeeAll: boolean;
}

function Choose<T extends string>({ options, value, onChange }: {
  options: ReadonlyArray<{ value: T; label: string }>; value: T; onChange: (value: T) => void;
}) {
  return (
    <div className="spring-group flex flex-wrap gap-2">
      {options.map((o) => (
        <Button key={o.value} size="sm" tone={o.value === value ? 'ink' : 'outline'} onClick={() => onChange(o.value)}>{o.label}</Button>
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
  onClose: () => void;
  onSave: (editing: ProjectEditing, draft: ProjectDraft) => Promise<void>;
  onDelete: (project: Project) => Promise<void>;
}> = ({ editing, clients, guests, onClose, onSave, onDelete }) => {
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editing) { setDraft(null); return; }
    const p = editing.kind === 'edit' ? editing.project : null;
    setDraft({
      name: p?.name ?? '', status: p?.status ?? 'active', priority: p?.priority ?? null,
      lead: p?.lead ?? 'Hamed', date: p?.date ?? null, client: editing.client,
      memberUids: p?.memberUids ?? [], guestsSeeAll: p?.guestsSeeAll ?? false,
    });
    setSure(false);
    setError('');
  }, [editing]);

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
    run(async () => { await onSave(editing, { ...draft, name: draft.name.trim() }); onClose(); });
  };

  return (
    <AppModal isOpen={editing !== null} onClose={onClose} title={editing?.kind === 'edit' ? 'Project' : 'New project'}>
      {draft && editing && (
        <div className="flex flex-col gap-5 max-h-[72vh] overflow-y-auto pr-1">
          <Field label="Name">
            <TextInput dir="auto" autoFocus={editing.kind === 'new'} value={draft.name} onChange={(e) => set('name', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
          </Field>
          <Field label="Status"><Choose<ProjectStatus> options={PROJECT_STATUSES} value={draft.status} onChange={(v) => set('status', v)} /></Field>
          <Field label="Priority">
            <Choose<Priority | 'none'> options={[...PRIORITIES, { value: 'none', label: 'None' }]} value={draft.priority ?? 'none'} onChange={(v) => set('priority', v === 'none' ? null : v)} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Client">
              <TextInput dir="auto" list="work-clients" value={draft.client ?? ''} onChange={(e) => set('client', e.target.value || null)} placeholder="Who is it for?" />
              <datalist id="work-clients">{clients.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label="Lead"><TextInput dir="auto" value={draft.lead ?? ''} onChange={(e) => set('lead', e.target.value || null)} /></Field>
            <Field label="Date"><TextInput type="date" value={draft.date ?? ''} onChange={(e) => set('date', e.target.value || null)} /></Field>
          </div>

          <Field label="Guests on this project">
            {guests.length === 0 ? (
              <p className="font-mono-main text-[10px] text-ink/40">Invite someone from the Guests list on Home first.</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="spring-group flex flex-wrap gap-2">
                  {guests.map((guest) => {
                    const on = !!guest.uid && draft.memberUids.includes(guest.uid);
                    return (
                      <Button
                        key={guest.email}
                        size="sm"
                        tone={on ? 'ink' : 'outline'}
                        disabled={!guest.uid}
                        data-tip={guest.uid ? undefined : 'They appear here once they have signed in'}
                        onClick={() => guest.uid && set('memberUids', on ? draft.memberUids.filter((u) => u !== guest.uid) : [...draft.memberUids, guest.uid])}
                      >
                        {guest.name || guest.email}
                      </Button>
                    );
                  })}
                </div>
                <div className="spring-group flex gap-2">
                  <Button size="sm" tone={draft.guestsSeeAll ? 'outline' : 'ink'} onClick={() => set('guestsSeeAll', false)}>Only their own tasks</Button>
                  <Button size="sm" tone={draft.guestsSeeAll ? 'ink' : 'outline'} onClick={() => set('guestsSeeAll', true)}>Everyone's tasks</Button>
                </div>
              </div>
            )}
          </Field>
          {error && <p className="font-mono-main text-[10px] text-rust">{error}</p>}
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
