import React, { useEffect, useState } from 'react';
import { AppModal } from '@/ui/AppModal';
import { Button } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { ChooseRow, Field, SelectMenu, SelectMulti, TextInput } from '@/ui/Form';
import { clearDraft, loadDraft, saveDraft } from '@/lib/draftMemory';
import { PRIORITY_COLOR } from '@/features/work/components/chips';
import { PROJECT_STATUSES } from '@/domain/work/projects';
import { PRIORITIES } from '@/domain/work/tasks';
import type { Invitation } from '@/domain/access';
import { OWNER_KEY } from '@/domain/work/sharing';
import type { Priority, Project, ProjectStatus } from '@/domain/work/types';

export type ProjectEditing = { kind: 'edit'; project: Project; client: string | null } | { kind: 'new'; client: string | null };

export interface ProjectDraft {
  name: string;
  status: ProjectStatus;
  priority: Priority | null;
  /** The project's leads as names, joined (what cards and tables show); written from `leads` and `leadExtra` on save. */
  lead: string | null;
  /** Who leads it: Hamed (`OWNER_KEY`) and guests by uid. Every guest here also runs the project (is an admin) and is on it. */
  leads: string[];
  /** Names in an older project's `lead` that match nobody Hamed has invited: kept as they were. */
  leadExtra: string[];
  date: string | null;
  endDate: string | null;
  client: string | null;
  /** The guests on the project, and whether they see everyone's tasks in it. */
  memberUids: string[];
  guestsSeeAll: boolean;
  /** The members who run the project with Hamed: the guests among the leads (each is also in `memberUids`). */
  adminUids: string[];
  /** The names and photos of the members (and Hamed), written onto the project so a guest can name who a task is for. */
  memberProfiles: Project['memberProfiles'];
}

/** What the form starts with: the project being changed, or a new one (led by Hamed unless told otherwise). */
function draftOf(editing: ProjectEditing, owner: { name: string }, guests: readonly Invitation[]): ProjectDraft {
  const p = editing.kind === 'edit' ? editing.project : null;
  // The leads: the project's admins, Hamed if his name is in `lead`; a new project is led by Hamed. Other names in an older `lead` are kept as text.
  const named = (p?.lead ?? '').split(',').map((n) => n.trim()).filter(Boolean);
  const knownNames = new Map<string, string>([[owner.name, OWNER_KEY], ...guests.filter((g) => g.uid).map((g) => [g.name || g.email, g.uid as string] as const)]);
  const fromNames = named.map((n) => knownNames.get(n)).filter((k): k is string => !!k);
  const leads = p ? [...new Set([...fromNames, ...(p.adminUids ?? [])])] : [OWNER_KEY];
  const leadExtra = named.filter((n) => !knownNames.has(n));
  return {
    name: p?.name ?? '', status: p?.status ?? 'active', priority: p?.priority ?? null,
    lead: p?.lead ?? owner.name, leads, leadExtra, date: p?.date ?? null, endDate: p?.endDate ?? null, client: editing.client,
    memberUids: p?.memberUids ?? [], guestsSeeAll: p?.guestsSeeAll ?? false, adminUids: p?.adminUids ?? [], memberProfiles: p?.memberProfiles ?? {},
  };
}

const NEW = '__new__';
const DRAFT_KEY = 'work_project_draft';

/** Making or changing a project. Who it is for (the client) is written to the owner-only record, never to the project. */
export const ProjectModal: React.FC<{
  editing: ProjectEditing | null;
  clients: readonly string[];
  /** The guests Hamed has invited; the ones who have signed in (so have a uid) can be put on a project. */
  guests: readonly Invitation[];
  /** Hamed himself, who can lead a project too. */
  owner: { name: string; photoUrl: string | null };
  /** A project's admin (a guest) changes only its name, status, priority and dates — no client, lead, guests or deleting. */
  limited?: boolean;
  onClose: () => void;
  onSave: (editing: ProjectEditing, draft: ProjectDraft) => Promise<void>;
  onDelete: (project: Project) => Promise<void>;
}> = ({ editing, clients, guests, owner, limited = false, onClose, onSave, onDelete }) => {
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const [error, setError] = useState('');
  /** Typing the name of a client who is not in the list yet. */
  const [newClient, setNewClient] = useState(false);

  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!editing) { setDraft(null); return; }
    const fresh = draftOf(editing, owner, guests);
    // A new project closed by accident comes back as it was left, for a few minutes.
    const saved = editing.kind === 'new' ? loadDraft<ProjectDraft>(DRAFT_KEY) : null;
    const keep = !!saved && !!saved.name.trim();
    setDraft(keep ? { ...fresh, ...saved } : fresh);
    setRestored(keep);
    setSure(false);
    setError('');
    setNewClient(false);
  }, [editing]);

  // Remembered as it is typed (a new project only).
  useEffect(() => {
    if (editing?.kind === 'new' && draft && (draft.name.trim() || draft.client)) saveDraft(DRAFT_KEY, draft);
  }, [draft, editing]);

  // Everyone who can lead a project: Hamed and the guests he has invited (a guest is on the list once they have signed in).
  const signedIn = guests.filter((g) => !!g.uid && g.active !== false);
  const personOf = (key: string) => (key === OWNER_KEY ? owner.name : signedIn.find((g) => g.uid === key)?.name || signedIn.find((g) => g.uid === key)?.email || '');
  // Who can lead: Hamed and the guests who have signed in. A guest who leads is on the project and runs it.
  const leadOptions = [
    { value: OWNER_KEY, label: owner.name, photoUrl: owner.photoUrl, withAvatar: true },
    ...signedIn.map((g) => ({ value: g.uid as string, label: g.name || g.email, photoUrl: g.photoUrl, withAvatar: true })),
  ];
  const setLeads = (leads: string[]) => setDraft((d) => {
    if (!d) return d;
    const guestLeads = leads.filter((k) => k !== OWNER_KEY);
    return { ...d, leads, adminUids: guestLeads, memberUids: [...new Set([...d.memberUids, ...guestLeads])] };
  });
  // A guest who leads can't be taken off the project from the members list without ceasing to lead first.
  const setMembers = (members: string[]) => setDraft((d) => (d ? { ...d, memberUids: [...new Set([...members, ...d.leads.filter((k) => k !== OWNER_KEY)])] } : d));

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
    // Who is on the project is written with their names and photos, so a guest (who can't read the guest list) can name them.
    const named = Object.fromEntries([
      [OWNER_KEY, { name: owner.name, photoUrl: owner.photoUrl }],
      ...signedIn.filter((g) => draft.memberUids.includes(g.uid as string)).map((g) => [g.uid as string, { name: g.name || g.email, photoUrl: g.photoUrl ?? null }] as const),
    ]);
    const adminUids = draft.leads.filter((k) => k !== OWNER_KEY && draft.memberUids.includes(k));
    const lead = [...draft.leads.map(personOf).filter(Boolean), ...draft.leadExtra].join(', ') || null;
    run(async () => { await onSave(editing, { ...draft, lead, adminUids, memberProfiles: named, name: draft.name.trim() }); clearDraft(DRAFT_KEY); onClose(); });
  };

  return (
    <AppModal isOpen={editing !== null} onClose={onClose} title={editing?.kind === 'edit' ? 'Project' : 'New project'}>
      {draft && editing && (
        <div className="flex flex-col gap-5 max-h-[72vh] overflow-y-auto pr-1">
          {restored && (
            <div className="flex items-center justify-between gap-3 rounded-box bg-ink/5 px-4 py-2.5 font-mono-main text-[13px] text-ink/60">
              <span>Picked up where you left off.</span>
              <Button tone="ghost" size="sm" onClick={() => { clearDraft(DRAFT_KEY); setRestored(false); setDraft(draftOf(editing, owner, guests)); }}>Start over</Button>
            </div>
          )}
          <Field label="Name">
            <TextInput dir="auto" autoFocus={editing.kind === 'new'} value={draft.name} onChange={(e) => set('name', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
          </Field>
          <Field label="Status"><ChooseRow<ProjectStatus> options={PROJECT_STATUSES} value={draft.status} onChange={(v) => set('status', v)} /></Field>
          <Field label="Priority">
            <ChooseRow<Priority | 'none'> options={[...PRIORITIES, { value: 'none', label: 'None' }]} colors={PRIORITY_COLOR} value={draft.priority ?? 'none'} onChange={(v) => set('priority', v === 'none' ? null : v)} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!limited && <Field label="Client">
              <SelectMenu
                ariaLabel="Client"
                value={newClient ? NEW : draft.client ?? ''}
                onChange={(v) => { if (v === NEW) { setNewClient(true); set('client', null); } else { setNewClient(false); set('client', v || null); } }}
                options={[{ value: '', label: 'No client' }, ...clients.map((c) => ({ value: c, label: c })), ...(draft.client && !clients.includes(draft.client) && !newClient ? [{ value: draft.client, label: draft.client }] : []), { value: NEW, label: '+ New client…' }]}
              />
              {newClient && <TextInput dir="auto" autoFocus className="mt-2" value={draft.client ?? ''} onChange={(e) => set('client', e.target.value || null)} placeholder="The new client's name" />}
            </Field>}
            {!limited && <Field label="Lead">
              <SelectMulti ariaLabel="Lead" empty="No lead" values={draft.leads} onChange={setLeads} options={leadOptions} />
              {draft.leads.some((k) => k !== OWNER_KEY) && (
                <p className="font-mono-main text-[11px] leading-relaxed text-ink/40 mt-2">
                  A guest who leads runs the project with you: sees all its tasks, adds and changes them, gives them to other members, and edits its name, status and dates.
                </p>
              )}
            </Field>}
            <Field label="Start"><DatePicker flow ariaLabel="Start" value={draft.date} onChange={(d) => set('date', d)} /></Field>
            <Field label="End"><DatePicker flow ariaLabel="End" value={draft.endDate} onChange={(d) => set('endDate', d)} /></Field>
          </div>

          {!limited && <Field label="Guests on this project">
            {guests.length === 0 ? (
              <p className="font-mono-main text-[12px] text-ink/40">Invite someone from the Guests list on Home first.</p>
            ) : (
              <div className="flex flex-col gap-3">
                <SelectMulti
                  ariaLabel="Guests on this project"
                  empty="Nobody"
                  values={draft.memberUids}
                  onChange={setMembers}
                  options={signedIn.map((g) => ({ value: g.uid as string, label: g.name || g.email, photoUrl: g.photoUrl, withAvatar: true }))}
                />
                <div className="spring-group flex gap-2">
                  <Button size="sm" tone={draft.guestsSeeAll ? 'outline' : 'ink'} onClick={() => set('guestsSeeAll', false)}>Only their own tasks</Button>
                  <Button size="sm" tone={draft.guestsSeeAll ? 'ink' : 'outline'} onClick={() => set('guestsSeeAll', true)}>Everyone's tasks</Button>
                </div>
              </div>
            )}
          </Field>}
          {error && <p className="font-mono-main text-[12px] text-rust">{error}</p>}
          <div className="spring-group flex gap-3 justify-end pt-2">
            {editing.kind === 'edit' && !limited && (
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
