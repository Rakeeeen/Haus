import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { NAME } from '@/constants/brand';
import { useWork } from '@/data/useWork';
import { countTasks, progressOf } from '@/domain/work/projects';
import { dayKey, moveToStatus } from '@/domain/work/tasks';
import type { Task } from '@/domain/work/types';
import { Button } from '@/ui/Button';
import { IconPlus as Plus } from '@/ui/icons';
import { ProgressBar } from '@/ui/ProgressBar';
import { PriorityChip, ProjectStatusChip, shortDate } from '@/features/work/components/chips';
import { ProjectModal } from '@/features/work/components/ProjectModal';
import { TaskBoard } from '@/features/work/components/TaskBoard';
import { TaskModal, type TaskEditing } from '@/features/work/components/TaskModal';
import { WorkShell } from '@/features/work/components/WorkShell';
import { useProjectEditing } from '@/features/work/Projects';

const Property: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <p className="font-mono-main text-[9px] uppercase tracking-[0.2em] text-ink/35 mb-1.5">{label}</p>
    <div className="font-mono-main text-[12px] min-h-[20px] flex items-center">{children}</div>
  </div>
);

/** One project: what it is, how far along, and its tasks in columns. */
export const ProjectPage: React.FC<{ navigate: (to: string) => void; author: string }> = ({ navigate, author }) => {
  const { id } = useParams<{ id: string }>();
  const { tasks, privates, ready, addTask, updateTask, removeTask } = useWork();
  const { projects, clients, editing: projectEditing, setEditing: setProjectEditing, save, remove } = useProjectEditing();
  const [editing, setEditing] = useState<TaskEditing | null>(null);

  const project = projects.find((p) => p.id === id) ?? null;
  const mine = useMemo(() => tasks.filter((t) => t.projectId === id), [tasks, id]);
  const client = id ? privates[id]?.client ?? null : null;

  useEffect(() => { document.title = `${NAME} — ${project?.name ?? 'Project'}`; }, [project?.name]);

  if (ready && !project) {
    return (
      <WorkShell navigate={navigate} crumbs={[{ label: 'Home', to: 'home' }, { label: 'Work', to: 'work' }, { label: 'Projects', to: 'work/projects' }]} title="Not found">
        <p className="font-mono-main text-[11px] text-ink/50">There is no such project — it may have been deleted.</p>
      </WorkShell>
    );
  }
  if (!project) {
    return <WorkShell navigate={navigate} crumbs={[{ label: 'Home', to: 'home' }, { label: 'Work', to: 'work' }, { label: 'Projects', to: 'work/projects' }]} title="…"><span /></WorkShell>;
  }

  const counts = countTasks(mine);
  const toggleDone = (task: Task) => updateTask(task.id, moveToStatus(task, task.status === 'done' ? 'todo' : 'done'));
  const openNew = (status: Task['status'] = 'todo') => setEditing({ kind: 'new', defaults: { projectId: project.id, status, date: dayKey(new Date()) } });

  return (
    <WorkShell
      navigate={navigate}
      crumbs={[{ label: 'Home', to: 'home' }, { label: 'Work', to: 'work' }, { label: 'Projects', to: 'work/projects' }, { label: project.name }]}
      title={project.name}
      actions={<>
        <Button tone="outline" onClick={() => setProjectEditing({ kind: 'edit', project, client })}>Edit</Button>
        <Button onClick={() => openNew()}><Plus size={16} />New task</Button>
      </>}
    >
      <div className="card flex flex-col gap-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-5">
          <Property label="Status"><ProjectStatusChip status={project.status} /></Property>
          <Property label="Priority">{project.priority ? <PriorityChip priority={project.priority} /> : '—'}</Property>
          <Property label="Client"><span dir="auto">{client ?? '—'}</span></Property>
          <Property label="Lead"><span dir="auto">{project.lead ?? '—'}</span></Property>
          <Property label="Date">{shortDate(project.date) || '—'}</Property>
        </div>
        <div>
          <ProgressBar value={progressOf(mine)} showValue />
          <p className="font-mono-main text-[10px] text-ink/40 mt-2">{counts.done} of {counts.total} tasks done · {counts.open} open</p>
        </div>
      </div>

      {!ready ? (
        <p className="font-mono-main text-[11px] text-ink/40 py-10 text-center">Loading…</p>
      ) : (
        <TaskBoard
          tasks={mine}
          projectName={() => null}
          showDropped={mine.some((t) => t.status === 'dropped')}
          onOpen={(task) => setEditing({ kind: 'edit', task })}
          onMove={(task, status) => updateTask(task.id, moveToStatus(task, status))}
          onToggleDone={toggleDone}
          onAdd={openNew}
        />
      )}

      <TaskModal
        editing={editing}
        projects={projects}
        author={author}
        onClose={() => setEditing(null)}
        onCreate={async (draft) => { await addTask({ ...draft, doneAt: draft.status === 'done' ? new Date().toISOString() : null }); }}
        onUpdate={async (taskId, draft) => {
          const current = tasks.find((t) => t.id === taskId);
          await updateTask(taskId, { ...draft, ...(current ? moveToStatus(current, draft.status) : {}) });
        }}
        onDelete={removeTask}
      />
      <ProjectModal
        editing={projectEditing}
        clients={clients}
        onClose={() => setProjectEditing(null)}
        onSave={save}
        onDelete={async (p) => { await remove(p); navigate('work/projects'); }}
      />
    </WorkShell>
  );
};
