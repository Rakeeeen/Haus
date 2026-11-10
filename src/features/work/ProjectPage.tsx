import React, { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { NAME } from '@/constants/brand';
import { useWork } from '@/data/useWork';
import { countTasks, progressOf } from '@/domain/work/projects';
import { dayKey } from '@/domain/work/tasks';
import type { Task } from '@/domain/work/types';
import { Button } from '@/ui/Button';
import { IconPlus as Plus } from '@/ui/icons';
import { ProgressBar } from '@/ui/ProgressBar';
import { PriorityChip, ProjectStatusChip, shortDate } from '@/features/work/components/chips';
import { sortNotes } from '@/domain/work/notes';
import { ProjectModal } from '@/features/work/components/ProjectModal';
import { NoteRow } from '@/features/work/Notes';
import { TaskBoard } from '@/features/work/components/TaskBoard';
import { useTaskEditor } from '@/features/work/components/useTaskEditor';
import { WorkLoading } from '@/features/work/components/WorkLoading';
import { WorkShell } from '@/features/work/components/WorkShell';
import { useProjectEditing } from '@/features/work/Projects';

const Property: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <p className="font-mono-main text-[11px] uppercase tracking-[0.2em] text-ink/35 mb-1.5">{label}</p>
    <div className="font-mono-main text-[14px] min-h-[20px] flex items-center">{children}</div>
  </div>
);

/** One project: what it is, how far along, and its tasks in columns. */
export const ProjectPage: React.FC<{ navigate: (to: string, replace?: boolean) => void; author: string; authorPhoto?: string | null }> = ({ navigate, author, authorPhoto = null }) => {
  const { id } = useParams<{ id: string }>();
  const { role, tasks, notes, privates, ready, loadNotes, canEditTask, isProjectAdmin, setTaskStatus, toggleTaskDone, addNote } = useWork();
  useEffect(() => { if (role === 'owner') loadNotes?.(); }, [role, loadNotes]);
  const { guests, projects, clients, editing: projectEditing, setEditing: setProjectEditing, save, remove } = useProjectEditing();
  const editor = useTaskEditor(author, authorPhoto);

  const project = projects.find((p) => p.id === id) ?? null;
  const mine = useMemo(() => tasks.filter((t) => t.projectId === id), [tasks, id]);
  const client = id ? privates[id]?.client ?? null : null;

  useEffect(() => { document.title = `${NAME} — ${project?.name ?? 'Project'}`; }, [project?.name]);
  // A project that is gone (deleted, then Back pressed) sends you to the list, replacing this entry so Back doesn't return here.
  useEffect(() => { if (ready && !project) navigate('work/projects', true); }, [ready, project, navigate]);

  if (ready && !project) {
    return (
      <WorkShell navigate={navigate} crumbs={[{ label: 'Home', to: 'home' }, { label: 'Tasks', to: 'work' }, { label: 'Projects', to: 'work/projects' }]} title="Not found">
        <p className="font-mono-main text-[13px] text-ink/50">There is no such project — it may have been deleted.</p>
      </WorkShell>
    );
  }
  if (!project) {
    return <WorkShell navigate={navigate} crumbs={[{ label: 'Home', to: 'home' }, { label: 'Tasks', to: 'work' }, { label: 'Projects', to: 'work/projects' }]} title="…"><span /></WorkShell>;
  }

  const counts = countTasks(mine);
  const openNew = (status: Task['status'] = 'todo') => editor.open({ kind: 'new', defaults: { projectId: project.id, status, date: dayKey(new Date()) } });

  return (
    <WorkShell
      navigate={navigate}
      crumbs={[{ label: 'Home', to: 'home' }, { label: 'Tasks', to: 'work' }, { label: 'Projects', to: 'work/projects' }, { label: project.name }]}
      title={project.name}
      actions={<>
        {(role === 'owner' || isProjectAdmin(project.id)) && <Button tone="outline" onClick={() => setProjectEditing({ kind: 'edit', project, client })}>Edit</Button>}
        <Button onClick={() => openNew()}><Plus size={16} />New task</Button>
      </>}
    >
      <div className="card flex flex-col gap-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-5">
          <Property label="Status"><ProjectStatusChip status={project.status} /></Property>
          <Property label="Priority">{project.priority ? <PriorityChip priority={project.priority} /> : '—'}</Property>
          {role === 'owner' && <Property label="Client"><span dir="auto">{client ?? '—'}</span></Property>}
          <Property label="Lead"><span dir="auto">{project.lead ?? '—'}</span></Property>
          <Property label="Date">{shortDate(project.date) || '—'}</Property>
        </div>
        <div>
          <ProgressBar value={progressOf(mine)} showValue />
          <p className="font-mono-main text-[12px] text-ink/40 mt-2">{counts.done} of {counts.total} tasks done · {counts.open} open</p>
        </div>
      </div>

      {!ready ? (
        <WorkLoading />
      ) : (
        <TaskBoard
          tasks={mine}
          projectName={() => null}
          personOf={editor.personOf}
          showDropped={mine.some((t) => t.status === 'dropped')}
          onOpen={(task) => editor.open({ kind: 'edit', task })}
          canEdit={canEditTask}
          onMove={setTaskStatus}
          onToggleDone={toggleTaskDone}
          onAdd={openNew}
        />
      )}

      {role === 'owner' && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-sans-main text-lg font-black uppercase tracking-tight">Notes</h2>
            <Button tone="outline" size="sm" onClick={async () => navigate(`work/notes/${await addNote(project.id)}`)}><Plus size={12} />New note</Button>
          </div>
          {notes.filter((n) => n.projectId === project.id).length === 0 ? (
            <p className="font-mono-main text-[13px] text-ink/40">No notes on this project yet.</p>
          ) : (
            <div className="card !p-0 overflow-hidden">
              {sortNotes(notes.filter((n) => n.projectId === project.id)).map((note) => (
                <NoteRow key={note.id} note={note} projectName={null} onOpen={() => navigate(`work/notes/${note.id}`)} />
              ))}
            </div>
          )}
        </section>
      )}

      {editor.modal}
      <ProjectModal
        editing={projectEditing}
        clients={clients}
        guests={guests}
        owner={{ name: author, photoUrl: authorPhoto }}
        limited={role !== 'owner'}
        onClose={() => setProjectEditing(null)}
        onSave={save}
        onDelete={async (p) => { await remove(p); navigate('work/projects', true); }}
      />
    </WorkShell>
  );
};
