import React, { useEffect, useMemo } from 'react';
import { NAME } from '@/constants/brand';
import { useWork } from '@/data/useWork';
import { countTasks, isWorkedOn, progressOf, tasksByProject } from '@/domain/work/projects';
import { filterTasks, moveToStatus, sortTasks } from '@/domain/work/tasks';
import type { Task } from '@/domain/work/types';
import { Chip } from '@/ui/Chip';
import { ProgressBar } from '@/ui/ProgressBar';
import { DoneTick } from '@/features/work/components/TaskBoard';
import { shortDate, TaskStatusChip } from '@/features/work/components/chips';
import { WorkShell } from '@/features/work/components/WorkShell';

const Tile: React.FC<{ title: string; note: string; onClick?: () => void }> = ({ title, note, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={`card text-left flex flex-col gap-2 transition-colors ${onClick ? 'cursor-pointer hover:border-ink/40' : 'opacity-50 cursor-default'}`}
  >
    <span className="font-sans-main text-xl font-black uppercase tracking-tight">{title}</span>
    <span className="font-mono-main text-[10px] uppercase tracking-widest text-ink/45">{note}</span>
  </button>
);

/** The way into the work side: Projects, Tasks, Notes; what is being worked on, and what is due today. */
export const WorkHub: React.FC<{ navigate: (to: string) => void }> = ({ navigate }) => {
  const { role, projects, tasks, privates, ready, canEditTask, updateTask } = useWork();

  useEffect(() => { document.title = `${NAME} — Work`; }, []);

  const byProject = useMemo(() => tasksByProject(tasks), [tasks]);
  const working = projects.filter(isWorkedOn);
  const today = sortTasks(filterTasks(tasks, { day: { kind: 'today' } }));
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? null;
  const toggle = (task: Task) => canEditTask(task) && updateTask(task.id, moveToStatus(task, task.status === 'done' ? 'todo' : 'done'));
  const open = tasks.filter((t) => t.status === 'todo' || t.status === 'doing').length;

  return (
    <WorkShell navigate={navigate} crumbs={[{ label: 'Home', to: 'home' }, { label: 'Work' }]} title="Work">
      <div className={`grid grid-cols-1 gap-4 ${role === 'owner' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        <Tile title="Projects" note={`${working.length} working on · ${projects.length} in all`} onClick={() => navigate('work/projects')} />
        <Tile title="Tasks" note={`${open} open · ${today.length} today`} onClick={() => navigate('work/tasks')} />
        {role === 'owner' && <Tile title="Notes" note="Soon" />}
      </div>

      {!ready ? (
        <p className="font-mono-main text-[11px] text-ink/40 py-10 text-center">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <section className="card flex flex-col gap-4">
            <h2 className="font-sans-main text-lg font-black uppercase tracking-tight">Working on</h2>
            {working.length === 0 && <p className="font-mono-main text-[11px] text-ink/40">Nothing in progress.</p>}
            {working.map((project) => {
              const mine = byProject.get(project.id) ?? [];
              const client = privates[project.id]?.client;
              return (
                <div key={project.id} onClick={() => navigate(`work/projects/${project.id}`)} className="cursor-pointer group">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span dir="auto" className="font-sans-main text-[13px] font-bold truncate group-hover:underline">{project.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {client && <Chip tone="ink">{client}</Chip>}
                      <span className="font-mono-main text-[10px] text-ink/40 tabular-nums">{countTasks(mine).open} open</span>
                    </div>
                  </div>
                  <ProgressBar value={progressOf(mine)} showValue />
                </div>
              );
            })}
          </section>

          <section className="card flex flex-col gap-3">
            <h2 className="font-sans-main text-lg font-black uppercase tracking-tight">Today</h2>
            {today.length === 0 && <p className="font-mono-main text-[11px] text-ink/40">No tasks dated today.</p>}
            {today.map((task) => (
              <div key={task.id} className="flex items-center gap-3 py-1.5 border-t border-ink/8 first:border-t-0">
                {canEditTask(task) ? <DoneTick done={task.status === 'done'} onToggle={() => toggle(task)} /> : <span className="w-5 h-5 shrink-0" />}
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate('work/tasks')}>
                  <p dir="auto" className={`font-sans-main text-[13px] font-semibold truncate ${task.status === 'done' ? 'line-through text-ink/40' : ''}`}>{task.title || 'Untitled'}</p>
                  <p dir="auto" className="font-mono-main text-[9px] uppercase tracking-wider text-ink/40 truncate">{projectName(task.projectId) ?? 'No project'} · {shortDate(task.date)}</p>
                </div>
                <TaskStatusChip status={task.status} />
              </div>
            ))}
          </section>
        </div>
      )}
    </WorkShell>
  );
};
