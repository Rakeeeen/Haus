import React, { useEffect, useMemo } from 'react';
import { isDay, manyOf, oneOf, useStoredState } from '@/lib/useStoredState';
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
import { PriorityChip, shortDate, TaskStatusChip } from '@/features/work/components/chips';
import { useTaskEditor } from '@/features/work/components/useTaskEditor';
import { WorkLoading } from '@/features/work/components/WorkLoading';
import { WorkShell } from '@/features/work/components/WorkShell';

const Tile: React.FC<{ title: string; note: string; onClick?: () => void }> = ({ title, note, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={`card !py-4 text-left flex flex-col items-start gap-1 transition-colors ${onClick ? 'cursor-pointer hover:border-ink/40' : 'opacity-50 cursor-default'}`}
  >
    <span className="font-sans-main text-lg font-black uppercase tracking-tight">{title}</span>
    <span className="font-mono-main text-[12px] uppercase tracking-widest text-ink/45 truncate">{note}</span>
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
  // What is chosen here is remembered (even after a refresh); "Today" is remembered as "Today", not as one date.
  const [projectStatuses, setProjectStatuses] = useStoredState<ProjectStatus[]>('work_hub_project_statuses', [], manyOf(PROJECT_STATUSES.map((s) => s.value)));
  const [dayChoice, setDayChoice] = useStoredState<DayChoice>('work_hub_day', 'all', oneOf(DAYS.map((d) => d.value)));
  const [picked, setPicked] = useStoredState('work_hub_picked_day', dayKey(new Date()), isDay);
  const [taskStatuses, setTaskStatuses] = useStoredState<TaskStatus[]>('work_hub_task_statuses', [], manyOf(TASK_STATUS_OPTIONS.map((s) => s.value)));

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
        <WorkLoading />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <section className="card flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-sans-main text-lg font-black uppercase tracking-tight">Tasks</h2>
              <div className="spring-group flex flex-wrap items-center gap-2">
                <FilterSelect label="Day" options={DAYS} value={dayChoice} onChange={setDayChoice} />
                {dayChoice === 'pick' && <DatePicker ariaLabel="Day" allowClear={false} value={picked} onChange={(d) => d && setPicked(d)} />}
                <FilterMulti label="Status" options={TASK_STATUS_OPTIONS} values={taskStatuses} onChange={setTaskStatuses} />
              </div>
            </div>
            <div className="flex flex-col max-h-[22rem] overflow-y-auto pr-1">
              {shownTasks.length === 0 && <p className="font-mono-main text-[13px] text-ink/40">No tasks match.</p>}
              {shownTasks.map((task) => (
                <div key={task.id} className="flex items-start gap-3 rounded-box border border-ink/10 bg-paper-dark px-4 py-3 mb-2.5 last:mb-0 hover:border-ink/30 transition-colors">
                  <div className="pt-[3px]">{canEditTask(task) ? <DoneTick done={task.status === 'done'} onToggle={() => toggle(task)} /> : <span className="w-5 h-5 shrink-0 block" />}</div>
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => editor.open({ kind: 'edit', task })}>
                    <p dir="auto" className={`font-sans-main text-[15px] font-semibold text-left break-words ${task.status === 'done' || task.status === 'dropped' ? 'line-through text-ink/40' : ''}`}>{task.title || 'Untitled'}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {projectName(task.projectId) && <Chip tone="neutral" className="max-w-[180px] !normal-case !tracking-normal"><span dir="auto" className="truncate">{projectName(task.projectId)}</span></Chip>}
                      {task.date && <span className="font-mono-main text-[12px] tracking-wider text-ink/50">{shortDate(task.date)}</span>}
                      <PriorityChip priority={task.priority} />
                    </div>
                  </div>
                  <TaskStatusChip status={task.status} />
                </div>
              ))}
            </div>
          </section>
          <section className="card flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-sans-main text-lg font-black uppercase tracking-tight">Projects</h2>
              <FilterMulti label="Status" options={PROJECT_STATUSES} values={projectStatuses} onChange={setProjectStatuses} />
            </div>
            <div className="flex flex-col gap-4 max-h-[22rem] overflow-y-auto pr-1">
              {shownProjects.length === 0 && <p className="font-mono-main text-[13px] text-ink/40">No projects with that status.</p>}
              {shownProjects.map((project) => {
                const mine = byProject.get(project.id) ?? [];
                const client = privates[project.id]?.client;
                return (
                  <div key={project.id} onClick={() => navigate(`work/projects/${project.id}`)} className="cursor-pointer group">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span dir="auto" className="font-sans-main text-[15px] font-bold leading-relaxed truncate text-left group-hover:underline">{project.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {client && <Chip tone="ink">{client}</Chip>}
                        <span className="font-mono-main text-[12px] text-ink/40 tabular-nums">{countTasks(mine).open} open</span>
                      </div>
                    </div>
                    <ProgressBar value={progressOf(mine)} showValue />
                  </div>
                );
              })}
            </div>
          </section>

        </div>
      )}
      {editor.modal}
    </WorkShell>
  );
};
