import type { Task } from '@/domain/work/types';
import { FinanceVector, FocusVector, TasksVector, TimeVector, WaterVector } from '@/features/home/components/visuals';
import type { DockCard } from '@/features/home/Dock';

/** What the focus timer is doing, as the dock card shows it. */
export interface FocusState {
  running: boolean;
  overtime: boolean;
  paused: boolean;
  mode: string;
  /** Seconds left in the session, and seconds past its end in overtime. */
  timeLeft: number;
  overtimeSeconds: number;
  /** Focus minutes finished today, and the same in hours ("1.5"). */
  minutes: number;
  hours: string;
}

/** The small cards, in the order they are stacked — Water, Tasks, Focus, Finance, Time. A guest has no Finance. */
export function buildDockCards(input: { isOwner: boolean; glasses: number; dueToday: readonly Task[]; focus: FocusState; totalPhysical: number }): DockCard[] {
  const { isOwner, glasses, dueToday, focus, totalPhysical } = input;
  const focusMetric = focus.running || focus.overtime || focus.paused
    ? (focus.overtime
        ? `+${Math.floor(focus.overtimeSeconds / 60)}m`
        : `${Math.floor(focus.timeLeft / 60)}:${String(focus.timeLeft % 60).padStart(2, '0')}`)
    : `${focus.minutes > 0 ? focus.hours : '0'}h`;
  const cards: DockCard[] = [
    { id: 'water', title: 'Water', Vector: WaterVector, route: 'water', metric: `${glasses} / 12`, subText: 'GLASSES TODAY' },
    { id: 'tasks', title: 'Tasks', Vector: TasksVector, route: 'work', metric: String(dueToday.length), subText: 'DUE TODAY' },
    {
      id: 'pomodoro', title: 'Your Focus', Vector: FocusVector, route: 'pomodoro', metric: focusMetric,
      subText: focus.overtime ? 'OVERTIME' : focus.paused ? 'PAUSED' : focus.running ? focus.mode.toUpperCase() : 'FOCUSED TODAY',
    },
    { id: 'finance', title: 'Finance', Vector: FinanceVector, route: 'finance', metric: totalPhysical > 0 ? `${Math.round(totalPhysical).toLocaleString()}` : '—', subText: 'TOTAL BALANCE' },
    { id: 'time', title: 'Time', Vector: TimeVector, route: null, metric: null, subText: 'EGYPT' },
  ];
  return cards.filter((card) => isOwner || card.id !== 'finance');
}
