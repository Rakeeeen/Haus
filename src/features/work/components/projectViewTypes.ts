import type { Project, Task } from '@/domain/work/types';

/** What every way of looking at the projects (cards, table, timeline) is given. */
export interface ProjectViewProps {
  projects: readonly Project[];
  tasksOf: (projectId: string) => readonly Task[];
  clientOf: (projectId: string) => string | null;
  onOpen: (projectId: string) => void;
}
