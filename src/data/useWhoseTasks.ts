import { oneOf, useStoredState } from '@/lib/useStoredState';

/** Whose tasks to show: only the ones that are for me, or everyone's that I can see. */
export type Whose = 'mine' | 'all';

export const WHOSE_OPTIONS = [
  { value: 'mine', label: 'Mine' },
  { value: 'all', label: 'Everyone' },
] as const;

/** The choice is remembered, and shared by every screen that lists tasks (Tasks home, All tasks, the Home card). */
export function useWhoseTasks(): [Whose, (value: Whose) => void] {
  return useStoredState<Whose>('work_whose', 'mine', oneOf(WHOSE_OPTIONS.map((o) => o.value)));
}
