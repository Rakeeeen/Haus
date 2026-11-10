import React, { useEffect, useMemo, useState } from 'react';
import { isDay, oneOf, useStoredState } from '@/lib/useStoredState';
import { NAME } from '@/constants/brand';
import { useWork } from '@/data/useWork';
import { addDays, dayKey, filterTasks, moveToStatus, type DayFilter } from '@/domain/work/tasks';
import type { Task, TaskStatus } from '@/domain/work/types';
import { Button } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { FilterSelect } from '@/ui/FilterSelect';
import { TextInput } from '@/ui/Form';
import { IconPlus as Plus } from '@/ui/icons';
import { Tabs } from '@/ui/Tabs';
import { TaskBoard } from '@/features/work/components/TaskBoard';
import { TaskCalendar } from '@/features/work/components/TaskCalendar';
import { useTaskEditor } from '@/features/work/components/useTaskEditor';
import { TaskTable } from '@/features/work/components/TaskTable';
import { WorkLoading } from '@/features/work/components/WorkLoading';
import { WorkShell } from '@/features/work/components/WorkShell';

type View = 'board' | 'table' | 'calendar';
type DayChoice = 'today' | 'tomorrow' | 'overdue' | 'all' | 'undated' | 'pick';
type StatusChoice = 'all' | 'open' | TaskStatus;

const VIEWS = [{ value: 'board', label: 'Board' }, { value: 'table', label: 'Table' }, { value: 'calendar', label: 'Calendar' }] as const;
const DAYS = [
  { value: 'today', label: 'Today' }, { value: 'tomorrow', label: 'Tomorrow' }, { value: 'overdue', label: 'Overdue' }, { value: 'all', label: 'All' },
  { value: 'undated', label: 'No date' }, { value: 'pick', label: 'Pick a date' },
] as const;
const STATUSES = [
  { value: 'all', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'todo', label: 'To do' },
  { value: 'doing', label: 'Doing' }, { value: 'done', label: 'Done' }, { value: 'dropped', label: 'Dropped' },
] as const;

const VIEW_KEY = 'work_tasks_view';
const readView = (): View => {
  try { const v = window.localStorage.getItem(VIEW_KEY); if (v === 'board' || v === 'table' || v === 'calendar') return v; } catch { /* no storage: use the default */ }
  return 'board';
};

export const Tasks: React.FC<{ navigate: (to: string) => void; author: string; authorPhoto?: string | null }> = ({ navigate, author, authorPhoto = null }) => {
  const { tasks, projects, ready, canEditTask, updateTask } = useWork();
  const [view, setView] = useState<View>(readView);
  const [dayChoice, setDayChoice] = useStoredState<DayChoice>('work_tasks_day', 'all', oneOf(DAYS.map((d) => d.value)));
  const [picked, setPicked] = useStoredState('work_tasks_picked_day', dayKey(new Date()), isDay);
  const [statusChoice, setStatusChoice] = useStoredState<StatusChoice>('work_tasks_status', 'all', oneOf(STATUSES.map((s) => s.value)));
  const [projectChoice, setProjectChoice] = useState<string>('all');
  const [query, setQuery] = useState('');
  const editor = useTaskEditor(author, authorPhoto);

  useEffect(() => { document.title = `${NAME} — Tasks`; }, []);
  useEffect(() => { try { window.localStorage.setItem(VIEW_KEY, view); } catch { /* fine */ } }, [view]);

  const projectName = useMemo(() => {
    const names = new Map(projects.map((p) => [p.id, p.name]));
    return (id: string | null) => (id ? names.get(id) ?? null : null);
  }, [projects]);

  // "Today" and "Tomorrow" are worked out each time the page draws, so they follow the real date on their own.
  const day: DayFilter = dayChoice === 'pick' ? { kind: 'day', day: picked }
    : dayChoice === 'tomorrow' ? { kind: 'day', day: addDays(dayKey(new Date()), 1) } : { kind: dayChoice };
  const statuses: TaskStatus[] | undefined = statusChoice === 'all' ? undefined : statusChoice === 'open' ? ['todo', 'doing'] : [statusChoice];
  const base = { statuses, projectId: projectChoice === 'all' ? undefined : projectChoice, query };
  const shown = filterTasks(tasks, { ...base, day });
  const calendarTasks = filterTasks(tasks, { ...base, day: { kind: 'all' } });

  const dayForNew = day.kind === 'day' ? day.day : dayKey(new Date());
  const openNew = (defaults: Partial<Task> = {}) => editor.open({ kind: 'new', defaults: { date: dayForNew, ...defaults } });
  const openTask = (task: Task) => editor.open({ kind: 'edit', task });
  const toggleDone = (task: Task) => canEditTask(task) && updateTask(task.id, moveToStatus(task, task.status === 'done' ? 'todo' : 'done'));

  return (
    <WorkShell
      navigate={navigate}
      crumbs={[{ label: 'Home', to: 'home' }, { label: 'Work', to: 'work' }, { label: 'Tasks' }]}
      title="Tasks"
      actions={<Button onClick={() => openNew()}><Plus size={16} />New task</Button>}
    >
      <Tabs options={VIEWS} value={view} onChange={setView} layoutId="work-tasks-view" ruled />

      <div className="spring-group flex flex-wrap items-center gap-3">
        {view !== 'calendar' && <FilterSelect label="Day" options={DAYS} value={dayChoice} onChange={setDayChoice} />}
        {view !== 'calendar' && dayChoice === 'pick' && <DatePicker ariaLabel="Day" allowClear={false} value={picked} onChange={(d) => d && setPicked(d)} />}
        <FilterSelect label="Status" options={STATUSES} value={statusChoice} onChange={setStatusChoice} />
        <FilterSelect
          label="Project"
          options={[{ value: 'all', label: 'All' }, { value: 'none', label: 'No project' }, ...[...projects].sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ value: p.id, label: p.name }))]}
          value={projectChoice}
          onChange={setProjectChoice}
        />
        <TextInput dir="auto" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="!w-48 !py-2 !text-[14px]" aria-label="Search tasks" />
      </div>

      {!ready ? (
        <WorkLoading />
      ) : view === 'board' ? (
        <TaskBoard
          tasks={shown}
          projectName={projectName}
          personOf={editor.personOf}
          showDropped={shown.some((t) => t.status === 'dropped')}
          onOpen={openTask}
          canEdit={canEditTask}
          onMove={(task, status) => canEditTask(task) && updateTask(task.id, moveToStatus(task, status))}
          onToggleDone={toggleDone}
          onAdd={(status) => openNew({ status })}
        />
      ) : view === 'table' ? (
        <TaskTable tasks={shown} projectName={projectName} canEdit={canEditTask} onOpen={openTask} onToggleDone={toggleDone} />
      ) : (
        <TaskCalendar tasks={calendarTasks} onOpen={openTask} onAddOnDay={(d) => openNew({ date: d })} />
      )}

      {editor.modal}
    </WorkShell>
  );
};
