import React, { useEffect, useMemo, useState } from 'react';
import { NAME } from '@/constants/brand';
import { useWork } from '@/data/useWork';
import { dayKey, filterTasks, moveToStatus, type DayFilter } from '@/domain/work/tasks';
import type { Task, TaskStatus } from '@/domain/work/types';
import { Button } from '@/ui/Button';
import { FilterSelect } from '@/ui/FilterSelect';
import { TextInput } from '@/ui/Form';
import { IconPlus as Plus } from '@/ui/icons';
import { Tabs } from '@/ui/Tabs';
import { TaskBoard } from '@/features/work/components/TaskBoard';
import { TaskCalendar } from '@/features/work/components/TaskCalendar';
import { useTaskEditor } from '@/features/work/components/useTaskEditor';
import { TaskTable } from '@/features/work/components/TaskTable';
import { WorkShell } from '@/features/work/components/WorkShell';

type View = 'board' | 'table' | 'calendar';
type DayChoice = 'today' | 'overdue' | 'all' | 'undated' | 'pick';
type StatusChoice = 'all' | 'open' | TaskStatus;

const VIEWS = [{ value: 'board', label: 'Board' }, { value: 'table', label: 'Table' }, { value: 'calendar', label: 'Calendar' }] as const;
const DAYS = [
  { value: 'today', label: 'Today' }, { value: 'overdue', label: 'Overdue' }, { value: 'all', label: 'All' },
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

export const Tasks: React.FC<{ navigate: (to: string) => void; author: string }> = ({ navigate, author }) => {
  const { tasks, projects, ready, canEditTask, updateTask } = useWork();
  const [view, setView] = useState<View>(readView);
  const [dayChoice, setDayChoice] = useState<DayChoice>('today');
  const [picked, setPicked] = useState(() => dayKey(new Date()));
  const [statusChoice, setStatusChoice] = useState<StatusChoice>('all');
  const [projectChoice, setProjectChoice] = useState<string>('all');
  const [query, setQuery] = useState('');
  const editor = useTaskEditor(author);

  useEffect(() => { document.title = `${NAME} — Tasks`; }, []);
  useEffect(() => { try { window.localStorage.setItem(VIEW_KEY, view); } catch { /* fine */ } }, [view]);

  const projectName = useMemo(() => {
    const names = new Map(projects.map((p) => [p.id, p.name]));
    return (id: string | null) => (id ? names.get(id) ?? null : null);
  }, [projects]);

  const day: DayFilter = dayChoice === 'pick' ? { kind: 'day', day: picked } : { kind: dayChoice };
  const statuses: TaskStatus[] | undefined = statusChoice === 'all' ? undefined : statusChoice === 'open' ? ['todo', 'doing'] : [statusChoice];
  const base = { statuses, projectId: projectChoice === 'all' ? undefined : projectChoice, query };
  const shown = filterTasks(tasks, { ...base, day });
  const calendarTasks = filterTasks(tasks, { ...base, day: { kind: 'all' } });

  const dayForNew = dayChoice === 'pick' ? picked : dayKey(new Date());
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

      <div className="flex flex-wrap items-center gap-3">
        {view !== 'calendar' && <FilterSelect label="Day" options={DAYS} value={dayChoice} onChange={setDayChoice} />}
        {view !== 'calendar' && dayChoice === 'pick' && <TextInput type="date" value={picked} onChange={(e) => e.target.value && setPicked(e.target.value)} className="!w-auto !py-2 !text-[12px]" aria-label="Day" />}
        <FilterSelect label="Status" options={STATUSES} value={statusChoice} onChange={setStatusChoice} />
        <FilterSelect
          label="Project"
          options={[{ value: 'all', label: 'All' }, { value: 'none', label: 'No project' }, ...[...projects].sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ value: p.id, label: p.name }))]}
          value={projectChoice}
          onChange={setProjectChoice}
        />
        <TextInput dir="auto" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="!w-48 !py-2 !text-[12px]" aria-label="Search tasks" />
      </div>

      {!ready ? (
        <p className="font-mono-main text-[11px] text-ink/40 py-10 text-center">Loading…</p>
      ) : view === 'board' ? (
        <TaskBoard
          tasks={shown}
          projectName={projectName}
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
