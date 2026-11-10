import React from 'react';
import { Chip, type ChipTone } from '@/ui/Chip';
import { projectStatusLabel } from '@/domain/work/projects';
import { statusLabel } from '@/domain/work/tasks';
import type { Priority, ProjectStatus, TaskStatus } from '@/domain/work/types';

const TASK_TONE: Record<TaskStatus, ChipTone> = { todo: 'neutral', doing: 'sepia', done: 'forest', dropped: 'rust' };
const PROJECT_TONE: Record<ProjectStatus, ChipTone> = { active: 'sepia', planning: 'neutral', maintenance: 'neutral', paused: 'neutral', done: 'forest' };
const PRIORITY_TONE: Record<Priority, ChipTone> = { high: 'rust', medium: 'neutral', low: 'neutral' };
const PRIORITY_LABEL: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' };

export const TaskStatusChip: React.FC<{ status: TaskStatus }> = ({ status }) => <Chip tone={TASK_TONE[status]}>{statusLabel(status)}</Chip>;
export const ProjectStatusChip: React.FC<{ status: ProjectStatus }> = ({ status }) => <Chip tone={PROJECT_TONE[status]}>{projectStatusLabel(status)}</Chip>;
export const PriorityChip: React.FC<{ priority: Priority | null }> = ({ priority }) =>
  priority ? <Chip tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</Chip> : null;

/** "9 Nov" (and the year, when it is not this one) for a "YYYY-MM-DD". */
export function shortDate(key: string | null, now: Date = new Date()): string {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(y !== now.getFullYear() ? { year: 'numeric' } : {}) });
}
