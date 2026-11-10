import React, { useEffect, useMemo } from 'react';
import { useWhoseTasks, WHOSE_OPTIONS } from '@/data/useWhoseTasks';
import { isDay, manyOf, oneOf, useStoredState } from '@/lib/useStoredState';
import { NAME } from '@/constants/brand';
import { useWork } from '@/data/useWork';
import { projectLabel, countTasks, filterProjectsByStatus, progressOf, PROJECT_STATUSES, tasksByProject } from '@/domain/work/projects';
import { addDays, dayKey, filterTasks, moveToStatus, sortTasks, type DayFilter } from '@/domain/work/tasks';
import type { ProjectStatus, Task, TaskStatus } from '@/domain/work/types';
import { AutoHeight } from '@/ui/AutoHeight';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { IconPlus as Plus } from '@/ui/icons';
import { DatePicker } from '@/ui/DatePicker';
import { FilterMulti, FilterSelect } from '@/ui/FilterSelect';
import { ProgressBar } from '@/ui/ProgressBar';
import { DoneTick } from '@/features/work/components/TaskBoard';
import { shortDate, TaskStatusChip } from '@/features/work/components/chips';
import { useTaskEditor } from '@/features/work/components/useTaskEditor';
import { WorkLoading } from '@/features/work/components/WorkLoading';
import { WorkShell } from '@/features/work/components/WorkShell';

type DayChoice = 'all' | 'today' | 'tomorrow' | 'overdue' | 'pick';
const DAYS = [
  { value: 'all', label: 'All' }, { value: 'today', label: 'Today' }, { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'overdue', label: 'Overdue' }, { value: 'pick', label: 'Pick a date' },
] as const;
const TASK_STATUS_OPTIONS = [{ value: 'todo', label: 'To do' }, { value: 'doing', label: 'Doing' }, { value: 'done', label: 'Done' }, { value: 'dropped', label: 'Dropped' }] as const;

/** The way into the work side: Projects, Tasks, Notes; the projects and the tasks, each narrowed the way you choose. */
export const WorkHub: React.FC<{ navigate: (to: string) => void; author: string; authorPhoto?: string | null }> = ({ navigate, author, authorPhoto = null }) => {
  const { role, me, projects, tasks, notes, privates, ready, canEditTask, updateTask } = useWork();
  const [whose, setWhose] = useWhoseTasks();
  const editor = useTaskEditor(author, authorPhoto);
  // What is chosen here is remembered (even after a refresh); "Today" is remembered as "Today", not as one date.
  const [projectStatuses, setProjectStatuses] = useStoredState<ProjectStatus[]>('work_hub_project_statuses', [], manyOf(PROJECT_STATUSES.map((s) => s.value)));
  const [dayChoice, setDayChoice] = useStoredState<DayChoice>('work_hub_day', 'all', oneOf(DAYS.map((d) => d.value)));
  const [picked, setPicked] = useStoredState('work_hub_picked_day', dayKey(new Date()), isDay);
  const [taskStatuses, setTaskStatuses] = useStoredState<TaskStatus[]>('work_hub_task_statuses', [], manyOf(TASK_STATUS_OPTIONS.map((s) => s.value)));

  useEffect(() => { document.title = `${NAME} — Tasks`; }, []);

  const byProject = useMemo(() => tasksByProject(tasks), [tasks]);
  const shownProjects = filterProjectsByStatus(projects, projectStatuses);
  // "Today" and "Tomorrow" are worked out as the page draws, so they follow the real date.
  const day: DayFilter = dayChoice === 'pick' ? { kind: 'day', day: picked }
    : dayChoice === 'tomorrow' ? { kind: 'day', day: addDays(dayKey(new Date()), 1) } : { kind: dayChoice };
  const forMe = whose === 'mine' ? me : undefined;
  const shownTasks = sortTasks(filterTasks(tasks, { day, statuses: taskStatuses, forMe }));
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? null;
  const toggle = (task: Task) => canEditTask(task) && updateTask(task.id, moveToStatus(task, task.status === 'done' ? 'todo' : 'done'));
  const open = tasks.filter((t) => (t.status === 'todo' || t.status === 'doing') && (!forMe || t.assigneeUids.includes(forMe))).length;

  return (
    <WorkShell navigate={navigate} crumbs={[{ label: 'Home', to: 'home' }, { label: 'Tasks' }]} title="Tasks" tight>
      {/* The way into each full page: one quiet row, instead of three big tiles repeating the cards below. */}
      <div className="spring-group flex flex-wrap gap-2">
        <Button tone="outline" size="sm" onClick={() => navigate('work/projects')}>Projects<span className="text-ink/40">{projects.length}</span></Button>
        <Button tone="outline" size="sm" onClick={() => navigate('work/tasks')}>All tasks<span className="text-ink/40">{open} open</span></Button>
        {role === 'owner' && <Button tone="outline" size="sm" onClick={() => navigate('work/notes')}>Notes<span className="text-ink/40">{notes.length}</span></Button>}
      </div>
      <hr className="border-0 border-t border-ink/10 w-full my-2" />

      {!ready ? (
        <WorkLoading />
      ) : (
        <div className="flex flex-col gap-6">
          <section className="card flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-mono-main text-[13px] font-semibold uppercase tracking-[0.22em] text-ink/50">Tasks</h2>
              <div className="spring-group flex flex-wrap items-center gap-2">
                <FilterSelect label="Whose" options={WHOSE_OPTIONS} value={whose} onChange={setWhose} />
                <FilterSelect label="Day" options={DAYS} value={dayChoice} onChange={setDayChoice} />
                {dayChoice === 'pick' && <DatePicker ariaLabel="Day" allowClear={false} value={picked} onChange={(d) => d && setPicked(d)} />}
                <FilterMulti label="Status" options={TASK_STATUS_OPTIONS} values={taskStatuses} onChange={setTaskStatuses} />
              </div>
            </div>
            <AutoHeight>
            <div className="flex flex-col max-h-[70vh] overflow-y-auto no-scrollbar">
              {shownTasks.length === 0 && <p className="font-mono-main text-[13px] text-ink/40">No tasks match.</p>}
              {shownTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 py-1.5 border-t border-ink/8 first:border-t-0">
                  {canEditTask(task) ? <DoneTick done={task.status === 'done'} onToggle={() => toggle(task)} /> : <span className="w-5 h-5 shrink-0" />}
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => editor.open({ kind: 'edit', task })}>
                    <p dir="auto" className={`font-sans-main text-[15px] font-semibold leading-relaxed text-left truncate ${task.status === 'done' ? 'line-through text-ink/40' : ''}`}>{task.title || 'Untitled'}</p>
                    {task.date && <p className="font-mono-main text-[12px] tracking-wider text-ink/45">{shortDate(task.date)}</p>}
                  </div>
                  {projectLabel(task, projectName) && <Chip tone="neutral" className="max-w-[180px] !normal-case !tracking-normal"><span dir="auto" className="truncate">{projectLabel(task, projectName)}</span></Chip>}
                  {task.status !== 'todo' && <TaskStatusChip status={task.status} />}
                </div>
              ))}
              <Button tone="ghost" size="sm" onClick={() => editor.open({ kind: 'new', defaults: { date: day.kind === 'day' ? day.day : dayKey(new Date()) } })} className="justify-start !px-2 mt-2">
                <Plus size={14} /> New task
              </Button>
            </div>
            </AutoHeight>
          </section>
          <section className="card flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-mono-main text-[13px] font-semibold uppercase tracking-[0.22em] text-ink/50">Projects</h2>
              <FilterMulti label="Status" options={PROJECT_STATUSES} values={projectStatuses} onChange={setProjectStatuses} />
            </div>
            <AutoHeight>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-5">
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
            </AutoHeight>
          </section>
        </div>
      )}
      {editor.modal}
    </WorkShell>
  );
};
