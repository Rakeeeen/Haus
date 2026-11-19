import type { MenuItem } from '@/ui/ContextMenu';
import { addDays, dayKey, TASK_STATUSES } from '@/domain/work/tasks';
import type { Priority, Task, TaskStatus } from '@/domain/work/types';

/** "9 Nov" for a "YYYY-MM-DD". */
const shortDay = (day: string) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };

/** What choosing a line of the task menu does; the menu itself only describes the lines. */
export interface TaskMenuActions {
  canEdit: boolean;
  canDelete: boolean;
  open?: () => void;
  setStatus: (status: TaskStatus) => void;
  setPriority: (priority: Priority | null) => void;
  /** A day, or null for no date. */
  setDate: (day: string | null) => void;
  duplicate: () => void;
  copyTitle: () => void;
  remove: () => void;
}

/**
 * The lines of the menu a right click on a task opens: open it, finish or reopen it, set its status, priority and date, duplicate it,
 * copy its title, delete it. Lines that change the task are off where this person may not change it, and Delete where they
 * may not delete it. `now` decides what Today, Tomorrow and Next week mean.
 */
export function buildTaskMenu(task: Task, actions: TaskMenuActions, now: Date = new Date()): MenuItem[] {
  const today = dayKey(now);
  const tomorrow = addDays(today, 1);
  const nextWeek = addDays(today, 7);
  const edit = !actions.canEdit;
  const items: MenuItem[] = [];
  if (actions.open) items.push({ kind: 'item', label: 'Open', hint: '↵', onSelect: actions.open });
  items.push({
    kind: 'item',
    label: task.status === 'done' ? 'Reopen' : 'Mark done',
    onSelect: () => actions.setStatus(task.status === 'done' ? 'todo' : 'done'),
    disabled: edit,
  });
  items.push({ kind: 'separator' });
  const status = TASK_STATUSES.map((st) => ({ value: st.value, label: st.label, active: st.value === task.status }));
  const priority = [
    { value: 'high', label: 'High', active: task.priority === 'high' },
    { value: 'medium', label: 'Medium', active: task.priority === 'medium' },
    { value: 'low', label: 'Low', active: task.priority === 'low' },
    { value: 'none', label: 'None', active: task.priority === null },
  ];
  const date = [
    { value: today, label: 'Today', active: task.date === today },
    { value: tomorrow, label: 'Tomorrow', active: task.date === tomorrow },
    { value: nextWeek, label: 'Next week', active: task.date === nextWeek },
    { value: 'none', label: 'No date', active: task.date === null },
  ];
  const shownDate = task.date === null ? 'None' : date.find((o) => o.active)?.label ?? shortDay(task.date);
  items.push({ kind: 'submenu', label: 'Status', value: status.find((o) => o.active)?.label, disabled: edit, options: status, onPick: (v) => actions.setStatus(v as TaskStatus) });
  items.push({ kind: 'submenu', label: 'Priority', value: priority.find((o) => o.active)?.label, disabled: edit, options: priority, onPick: (v) => actions.setPriority(v === 'none' ? null : (v as Priority)) });
  items.push({ kind: 'submenu', label: 'Date', value: shownDate, disabled: edit, options: date, onPick: (v) => actions.setDate(v === 'none' ? null : v) });
  items.push({ kind: 'separator' });
  items.push({ kind: 'item', label: 'Duplicate', onSelect: actions.duplicate, disabled: edit });
  items.push({ kind: 'item', label: 'Copy title', onSelect: actions.copyTitle });
  items.push({ kind: 'separator' });
  items.push({ kind: 'item', label: 'Delete', onSelect: actions.remove, danger: true, disabled: !actions.canDelete });
  return items;
}
