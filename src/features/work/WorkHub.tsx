import React, { useEffect, useMemo, useState } from 'react';
import { NAME } from '@/constants/brand';
import { useWork } from '@/data/useWork';
import { countTasks, filterProjectsByStatus, isWorkedOn, progressOf, PROJECT_STATUSES, tasksByProject } from '@/domain/work/projects';
import { addDays, dayKey, filterTasks, moveToStatus, sortTasks, type DayFilter } from '@/domain/work/tasks';
import type { ProjectStatus, Task, TaskStatus } from '@/domain/work/types';
import { Chip } from '@/ui/Chip';
import { DatePicker } from '@/ui/DatePicker';
import { FilterMulti, FilterSelect } from '@/ui/FilterSelect';
import { ProgressBar } from '@/ui/ProgressBar';
import { DoneTick } from '@/features/work/components/TaskBoard';
import { shortDate, TaskStatusChip } from '@/features/work/components/chips';
import { useTaskEditor } from '@/features/work/components/useTaskEditor';
import { WorkShell } from '@/features/work/components/WorkShell';

const Tile: React.FC<{ title: string; note: string; onClick?: () => void }> = ({ title, note, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={`card !py-4 text-left flex items-baseline justify-between gap-3 transition-colors ${onClick ? 'cursor-pointer hover:border-ink/40' : 'opacity-50 cursor-default'}`}
  >
    <span className="font-sans-main text-lg font-black uppercase tracking-tight">{title}</span>
    <span className="font-mono-main text-[10px] uppercase tracking-widest text-ink/45 truncate">{note}</span>
  </button>
);

type DayChoice = 'all' | 'today' | 'tomorrow' | 'overdue' | 'pick';
const DAYS = [
  { value: 'all', label: 'All' }, { value: 'today', label: 'Today' }, { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'overdue', label: 'Overdue' }, { value: 'pick', label: 'Pick a date' },
] as const;
const TASK_STATUS_OPTIONS = [{ value: 'todo', label: 'To do' }, { value: 'doing', label: 'Doing' }, { value: 'done', label: 'Done' }, { value: 'dropped', label: 'Dropped' }] as const;

/** The way into the work side: Projects, Tasks, Notes; the projects and the tasks, each narrowed the way you choose. */
export const WorkHub: React.FC<{ navigate: (to: string) => void; author: string; authorPhoto?: string | null }> = ({ navigate, author, authorPhoto = null }) => {
  const { role, projects, tasks, notes, privates, ready, canEditTask, updateTask } = useWork();
  const editor = useTaskEditor(author, authorPhoto);
  const [projectStatuses, setProjectStatuses] = useState<ProjectStatus[]>([]);
  const [dayChoice, setDayChoice] = useState<DayChoice>('all');
  const [picked, setPicked] = useState(() => dayKey(new Date()));
  const [taskStatuses, setTaskStatuses] = useState<TaskStatus[]>([]);

  useEffect(() => { document.title = `${NAME} — Work`; }, []);

  const byProject = useMemo(() => tasksByProject(tasks), [tasks]);
  const shownProjects = filterProjectsByStatus(projects, projectStatuses);
  // "Today" and "Tomorrow" are worked out as the page draws, so they follow the real date.
  const day: DayFilter = dayChoice === 'pick' ? { kind: 'day', day: picked }
    : dayChoice === 'tomorrow' ? { kind: 'day', day: addDays(dayKey(new Date()), 1) } : { kind: dayChoice };
  const shownTasks = sortTasks(filterTasks(tasks, { day, statuses: taskStatuses }));
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? null;
  const toggle = (task: Task) => canEditTask(task) && updateTask(task.id, moveToStatus(task, task.status === 'done' ? 'todo' : 'done'));
  const open = tasks.filter((t) => t.status === 'todo' || t.status === 'doing').length;
  const today = filterTasks(tasks, { day: { kind: 'today' } }).length;

  return (
    <WorkShell navigate={navigate} crumbs={[{ label: 'Home', to: 'home' }, { label: 'Work' }]} title="Work">
      <div className={`grid grid-cols-1 gap-4 ${role === 'owner' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        <Tile title="Projects" note={`${projects.filter(isWorkedOn).length} working on · ${projects.length} in all`} onClick={() => navigate('work/projects')} />
        <Tile title="Tasks" note={`${open} open · ${today} today`} onClick={() => navigate('work/tasks')} />
        {role === 'owner' && <Tile title="Notes" note={`${notes.length} in all`} onClick={() => navigate('work/notes')} />}
      </div>

      {!ready ? (
        <p className="font-mono-main text-[11px] text-ink/40 py-10 text-center">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <section className="card flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-sans-main text-lg font-black uppercase tracking-tight">Projects</h2>
              <FilterMulti label="Status" options={PROJECT_STATUSES} values={projectStatuses} onChange={setProjectStatuses} />
            </div>
            <div className="flex flex-col gap-4 max-h-[22rem] overflow-y-auto pr-1">
              {shownProjects.length === 0 && <p className="font-mono-main text-[11px] text-ink/40">No projects with that status.</p>}
              {shownProjects.map((project) => {
                const mine = byProject.get(project.id) ?? [];
                const client = privates[project.id]?.client;
                return (
                  <div key={project.id} onClick={() => navigate(`work/projects/${project.id}`)} className="cursor-pointer group">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span dir="auto" className="font-sans-main text-[13px] font-bold leading-relaxed truncate text-left group-hover:underline">{project.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {client && <Chip tone="ink">{client}</Chip>}
                        <span className="font-mono-main text-[10px] text-ink/40 tabular-nums">{countTasks(mine).open} open</span>
                      </div>
                    </div>
                    <ProgressBar value={progressOf(mine)} showValue />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-sans-main text-lg font-black uppercase tracking-tight">Tasks</h2>
              <div className="flex flex-wrap items-center gap-2">
                <FilterSelect label="Day" options={DAYS} value={dayChoice} onChange={setDayChoice} />
                {dayChoice === 'pick' && <DatePicker ariaLabel="Day" allowClear={false} value={picked} onChange={(d) => d && setPicked(d)} />}
                <FilterMulti label="Status" options={TASK_STATUS_OPTIONS} values={taskStatuses} onChange={setTaskStatuses} />
              </div>
            </div>
            <div className="flex flex-col max-h-[22rem] overflow-y-auto pr-1">
              {shownTasks.length === 0 && <p className="font-mono-main text-[11px] text-ink/40">No tasks match.</p>}
              {shownTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 py-1.5 border-t border-ink/8 first:border-t-0">
                  {canEditTask(task) ? <DoneTick done={task.status === 'done'} onToggle={() => toggle(task)} /> : <span className="w-5 h-5 shrink-0" />}
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => editor.open({ kind: 'edit', task })}>
                    <p dir="auto" className={`font-sans-main text-[13px] font-semibold leading-relaxed text-left truncate ${task.status === 'done' ? 'line-through text-ink/40' : ''}`}>{task.title || 'Untitled'}</p>
                    <p dir="auto" className="font-mono-main text-[9px] tracking-wider text-ink/40 truncate text-left">{projectName(task.projectId) ?? 'No project'}{task.date ? ` · ${shortDate(task.date)}` : ''}</p>
                  </div>
                  <TaskStatusChip status={task.status} />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
      {editor.modal}
    </WorkShell>
  );
};
