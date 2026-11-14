import { lazy } from 'react';
import { preloadWhenIdle } from '@/lib/idlePreload';

/**
 * The pages that load on first visit (which keeps Recharts and the notes editor out of the first screen). `preloadPages` then
 * fetches them quietly, in the order they are most likely to be opened, once the first screen is up and the browser is idle —
 * so opening one finds its code already here instead of waiting for the network behind a blank page.
 */
const loaders = {
  water: () => import('@/features/water/Water'),
  pomodoro: () => import('@/features/focus/Pomodoro'),
  finance: () => import('@/features/finance/Finance'),
  workHub: () => import('@/features/work/WorkHub'),
  tasks: () => import('@/features/work/Tasks'),
  projects: () => import('@/features/work/Projects'),
  notes: () => import('@/features/work/Notes'),
  notePage: () => import('@/features/work/NotePage'),
  activity: () => import('@/features/work/Activity'),
  projectPage: () => import('@/features/work/ProjectPage'),
};

export const Water = lazy(() => loaders.water().then((m) => ({ default: m.Water })));
export const Pomodoro = lazy(() => loaders.pomodoro().then((m) => ({ default: m.Pomodoro })));
export const Finance = lazy(() => loaders.finance().then((m) => ({ default: m.Finance })));
export const WorkHub = lazy(() => loaders.workHub().then((m) => ({ default: m.WorkHub })));
export const Tasks = lazy(() => loaders.tasks().then((m) => ({ default: m.Tasks })));
export const Projects = lazy(() => loaders.projects().then((m) => ({ default: m.Projects })));
export const Notes = lazy(() => loaders.notes().then((m) => ({ default: m.Notes })));
export const NotePage = lazy(() => loaders.notePage().then((m) => ({ default: m.NotePage })));
export const Activity = lazy(() => loaders.activity().then((m) => ({ default: m.Activity })));
export const ProjectPage = lazy(() => loaders.projectPage().then((m) => ({ default: m.ProjectPage })));

/** Quietly fetches the pages this person can open (Finance and Activity are Hamed's), the small ones first and the notes editor last. */
export function preloadPages(isOwner: boolean): void {
  preloadWhenIdle([
    loaders.water, loaders.pomodoro, loaders.workHub, loaders.tasks, loaders.projects, loaders.projectPage,
    ...(isOwner ? [loaders.finance, loaders.activity] : []),
    loaders.notes, loaders.notePage,
  ]);
}
