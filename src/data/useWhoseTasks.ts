import { useStoredState } from '@/lib/useStoredState';

/** Whose tasks to show: 'mine', 'all', or one person's key (see domain/work/whose.ts). */
export type Whose = string;

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** The choice is remembered, and shared by every screen that lists tasks (Tasks home, All tasks, the Home card). */
export function useWhoseTasks(): [Whose, (value: Whose) => void] {
  return useStoredState<Whose>('work_whose', 'mine', isText);
}
