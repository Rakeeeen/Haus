import React, { useEffect, useMemo, useState } from 'react';
import { NAME } from '@/constants/brand';
import { useWork } from '@/data/useWork';
import { isWorkedOn, tasksByProject } from '@/domain/work/projects';
import type { Project, Task } from '@/domain/work/types';
import { Button } from '@/ui/Button';
import { FilterSelect } from '@/ui/FilterSelect';
import { IconPlus as Plus } from '@/ui/icons';
import { Tabs } from '@/ui/Tabs';
import { ProjectModal, type ProjectDraft, type ProjectEditing } from '@/features/work/components/ProjectModal';
import { ProjectCards, ProjectTable, ProjectTimeline } from '@/features/work/components/ProjectViews';
import { WorkShell } from '@/features/work/components/WorkShell';

type View = 'cards' | 'table' | 'timeline';
type Show = 'working' | 'all' | 'planning' | 'paused' | 'done';

const VIEWS = [{ value: 'cards', label: 'Cards' }, { value: 'table', label: 'Table' }, { value: 'timeline', label: 'Timeline' }] as const;
const SHOWS = [
  { value: 'working', label: 'Working on' }, { value: 'all', label: 'All' }, { value: 'planning', label: 'Planning' },
  { value: 'paused', label: 'On hold' }, { value: 'done', label: 'Done' },
] as const;

const VIEW_KEY = 'work_projects_view';
const readView = (): View => {
  try { const v = window.localStorage.getItem(VIEW_KEY); if (v === 'cards' || v === 'table' || v === 'timeline') return v; } catch { /* use the default */ }
  return 'cards';
};

const matches = (project: Project, show: Show) => (show === 'all' ? true : show === 'working' ? isWorkedOn(project) : project.status === show);

/** Shared by the Projects page and a project's page: how to make or change one. */
export function useProjectEditing() {
  const { projects, privates, addProject, updateProject, setClient, removeProject } = useWork();
  const [editing, setEditing] = useState<ProjectEditing | null>(null);
  const clients = useMemo(() => [...new Set(Object.values(privates).map((p) => p.client).filter((c): c is string => !!c))].sort(), [privates]);

  const save = async (target: ProjectEditing, draft: ProjectDraft) => {
    const { client, ...fields } = draft;
    if (target.kind === 'edit') {
      await updateProject(target.project.id, fields);
      await setClient(target.project.id, client);
    } else {
      await addProject(fields, client);
    }
  };

  return { projects, clients, editing, setEditing, save, remove: (p: Project) => removeProject(p.id) };
}

export const Projects: React.FC<{ navigate: (to: string) => void }> = ({ navigate }) => {
  const { tasks, privates, ready } = useWork();
  const { projects, clients, editing, setEditing, save, remove } = useProjectEditing();
  const [view, setView] = useState<View>(readView);
  const [show, setShow] = useState<Show>('working');

  useEffect(() => { document.title = `${NAME} — Projects`; }, []);
  useEffect(() => { try { window.localStorage.setItem(VIEW_KEY, view); } catch { /* fine */ } }, [view]);

  const byProject = useMemo(() => tasksByProject(tasks), [tasks]);
  const tasksOf = (id: string): readonly Task[] => byProject.get(id) ?? [];
  const clientOf = (id: string) => privates[id]?.client ?? null;
  const shown = projects.filter((p) => matches(p, show));
  const common = { projects: shown, tasksOf, clientOf, onOpen: (id: string) => navigate(`work/projects/${id}`) };

  return (
    <WorkShell
      navigate={navigate}
      crumbs={[{ label: 'Home', to: 'home' }, { label: 'Work', to: 'work' }, { label: 'Projects' }]}
      title="Projects"
      actions={<Button onClick={() => setEditing({ kind: 'new', client: null })}><Plus size={16} />New project</Button>}
    >
      <Tabs options={VIEWS} value={view} onChange={setView} layoutId="work-projects-view" ruled />
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect label="Show" options={SHOWS} value={show} onChange={setShow} />
      </div>

      {!ready ? (
        <p className="font-mono-main text-[11px] text-ink/40 py-10 text-center">Loading…</p>
      ) : view === 'cards' ? (
        <ProjectCards {...common} onNew={(client) => setEditing({ kind: 'new', client })} />
      ) : view === 'table' ? (
        <ProjectTable {...common} />
      ) : (
        <ProjectTimeline {...common} />
      )}

      <ProjectModal editing={editing} clients={clients} onClose={() => setEditing(null)} onSave={save} onDelete={remove} />
    </WorkShell>
  );
};
