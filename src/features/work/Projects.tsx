import React, { useEffect, useMemo, useState } from 'react';
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
import { ProjectCards, ProjectTable, ProjectTimeline } from '@/features/work/components/ProjectViews';
import { WorkShell } from '@/features/work/components/WorkShell';

type View = 'cards' | 'table' | 'timeline';

const VIEWS = [{ value: 'cards', label: 'Cards' }, { value: 'table', label: 'Table' }, { value: 'timeline', label: 'Timeline' }] as const;
/** What is shown to begin with: what is being worked on. */
const WORKING: ProjectStatus[] = ['active', 'maintenance'];

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
    const { client, memberUids, guestsSeeAll, ...fields } = draft;
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
    if (memberUids.length || before?.memberUids.length || guestsSeeAll !== (before?.guestsSeeAll ?? false)) await setSharing(id, memberUids, guestsSeeAll);
  };

  return { role, projects, clients, guests, editing, setEditing, save, remove: (p: Project) => removeProject(p.id) };
}

export const Projects: React.FC<{ navigate: (to: string) => void }> = ({ navigate }) => {
  const { tasks, privates, ready } = useWork();
  const { role, projects, clients, guests, editing, setEditing, save, remove } = useProjectEditing();
  const [view, setView] = useState<View>(readView);
  const [statuses, setStatuses] = useState<ProjectStatus[]>(WORKING);

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
      crumbs={[{ label: 'Home', to: 'home' }, { label: 'Work', to: 'work' }, { label: 'Projects' }]}
      title="Projects"
      actions={role === 'owner' ? <Button onClick={() => setEditing({ kind: 'new', client: null })}><Plus size={16} />New project</Button> : undefined}
    >
      <Tabs options={VIEWS} value={view} onChange={setView} layoutId="work-projects-view" ruled />
      <div className="flex flex-wrap items-center gap-3">
        <FilterMulti label="Show" options={PROJECT_STATUSES} values={statuses} onChange={setStatuses} />
      </div>

      {!ready ? (
        <p className="font-mono-main text-[11px] text-ink/40 py-10 text-center">Loading…</p>
      ) : view === 'cards' ? (
        <ProjectCards {...common} onNew={role === 'owner' ? (client) => setEditing({ kind: 'new', client }) : undefined} />
      ) : view === 'table' ? (
        <ProjectTable {...common} />
      ) : (
        <ProjectTimeline {...common} />
      )}

      <ProjectModal editing={editing} clients={clients} guests={guests} onClose={() => setEditing(null)} onSave={save} onDelete={remove} />
    </WorkShell>
  );
};
