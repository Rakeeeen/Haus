import React, { useEffect, useMemo, useState } from 'react';
import { manyOf, useStoredState } from '@/lib/useStoredState';
import { NAME } from '@/constants/brand';
import { useGuests } from '@/data/useMembers';
import { useWork } from '@/data/useWork';
import { filterProjectsByStatus, PROJECT_STATUSES, tasksByProject } from '@/domain/work/projects';
import type { Project, ProjectStatus, Task } from '@/domain/work/types';
import { Button } from '@/ui/Button';
import { FilterMulti } from '@/ui/FilterSelect';
import { IconPlus as Plus } from '@/ui/icons';
import { Tabs } from '@/ui/Tabs';
import { ProjectModal, type ProjectDraft, type ProjectEditing } from '@/features/work/components/ProjectModal';
import { ProjectCards } from '@/features/work/components/ProjectCards';
import { ProjectTable } from '@/features/work/components/ProjectTable';
import { ProjectTimeline } from '@/features/work/components/ProjectTimeline';
import { WorkLoading } from '@/features/work/components/WorkLoading';
import { WorkShell } from '@/features/work/components/WorkShell';

type View = 'cards' | 'table' | 'timeline';

const VIEWS = [{ value: 'cards', label: 'Cards' }, { value: 'table', label: 'Table' }, { value: 'timeline', label: 'Timeline' }] as const;
const VIEW_KEY = 'work_projects_view';
const readView = (): View => {
  try { const v = window.localStorage.getItem(VIEW_KEY); if (v === 'cards' || v === 'table' || v === 'timeline') return v; } catch { /* use the default */ }
  return 'cards';
};

/** Shared by the Projects page and a project's page: how to make or change one. */
export function useProjectEditing() {
  const { role, projects, privates, addProject, updateProject, setSharing, setClient, removeProject } = useWork();
  const { guests } = useGuests(role === 'owner');
  const [editing, setEditing] = useState<ProjectEditing | null>(null);
  const clients = useMemo(() => [...new Set(Object.values(privates).map((p) => p.client).filter((c): c is string => !!c))].sort(), [privates]);

  const save = async (target: ProjectEditing, draft: ProjectDraft) => {
    const { client, memberUids, guestsSeeAll, adminUids, memberProfiles, ...fields } = draft;
    // A project's admin (a guest) changes only what the rules let them: its name, status, priority and dates.
    if (role !== 'owner') {
      if (target.kind === 'edit') await updateProject(target.project.id, { name: fields.name, status: fields.status, priority: fields.priority, date: fields.date, endDate: fields.endDate });
      return;
    }
    let id: string;
    if (target.kind === 'edit') {
      id = target.project.id;
      await updateProject(id, fields);
      await setClient(id, client);
    } else {
      id = await addProject(fields, client);
    }
    // Sharing changes who may see the project's tasks, so it is written on its own, with the tasks' viewers.
    const before = target.kind === 'edit' ? target.project : null;
    const sharingChanged = memberUids.length || before?.memberUids.length || guestsSeeAll !== (before?.guestsSeeAll ?? false)
      || [...adminUids].sort().join() !== [...(before?.adminUids ?? [])].sort().join();
    if (sharingChanged) await setSharing(id, memberUids, guestsSeeAll, adminUids, memberProfiles);
  };

  return { role, projects, clients, guests, editing, setEditing, save, remove: (p: Project) => removeProject(p.id) };
}

export const Projects: React.FC<{ navigate: (to: string) => void; author: string; authorPhoto?: string | null }> = ({ navigate, author, authorPhoto = null }) => {
  const { tasks, privates, ready, setClient } = useWork();
  const { role, projects, clients, guests, editing, setEditing, save, remove } = useProjectEditing();
  const [view, setView] = useState<View>(readView);
  const [statuses, setStatuses] = useStoredState<ProjectStatus[]>('work_projects_statuses', [], manyOf(PROJECT_STATUSES.map((p) => p.value)));

  useEffect(() => { document.title = `${NAME} — Projects`; }, []);
  useEffect(() => { try { window.localStorage.setItem(VIEW_KEY, view); } catch { /* fine */ } }, [view]);

  const byProject = useMemo(() => tasksByProject(tasks), [tasks]);
  const tasksOf = (id: string): readonly Task[] => byProject.get(id) ?? [];
  const clientOf = (id: string) => privates[id]?.client ?? null;
  const shown = filterProjectsByStatus(projects, statuses);
  const common = { projects: shown, tasksOf, clientOf, onOpen: (id: string) => navigate(`work/projects/${id}`) };

  return (
    <WorkShell
      navigate={navigate}
      crumbs={[{ label: 'Home', to: 'home' }, { label: 'Tasks', to: 'work' }, { label: 'Projects' }]}
      title="Projects"
      actions={role === 'owner' ? <Button onClick={() => setEditing({ kind: 'new', client: null })}><Plus size={16} />New project</Button> : undefined}
    >
      <Tabs options={VIEWS} value={view} onChange={setView} layoutId="work-projects-view" ruled />
      <div className="spring-group flex flex-wrap items-center gap-3">
        <FilterMulti label="Show" options={PROJECT_STATUSES} values={statuses} onChange={setStatuses} />
      </div>
      <hr className="border-0 border-t border-ink/10 w-full my-2" />

      {!ready ? (
        <WorkLoading />
      ) : view === 'cards' ? (
        <ProjectCards {...common} clients={clients} onNew={role === 'owner' ? (client) => setEditing({ kind: 'new', client }) : undefined} onMoveClient={role === 'owner' ? setClient : undefined} />
      ) : view === 'table' ? (
        <ProjectTable {...common} />
      ) : (
        <ProjectTimeline {...common} />
      )}

      <ProjectModal editing={editing} clients={clients} guests={guests} owner={{ name: author, photoUrl: authorPhoto }} onClose={() => setEditing(null)} onSave={save} onDelete={remove} />
    </WorkShell>
  );
};
