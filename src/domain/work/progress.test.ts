import { describe, it, expect } from 'vitest';
import { oldestCarried, taskProgress } from '@/domain/work/progress';
import { blankTask } from '@/domain/work/tasks';
import type { Task } from '@/domain/work/types';

const NOW = new Date(2026, 10, 19, 10, 0);   // 19 Nov 2026
const t = (id: string, over: Partial<Task>): Task => ({ ...blankTask(1, '2026-11-19', NOW), id, title: id, ...over });

describe('taskProgress', () => {
  const tasks = [
    t('today-open', { status: 'todo', date: '2026-11-19' }),
    t('today-doing', { status: 'doing', date: '2026-11-19' }),
    t('today-done', { status: 'done', date: '2026-11-19' }),
    t('today-dropped', { status: 'dropped', date: '2026-11-19' }),
    t('old-open', { status: 'todo', date: '2026-11-10' }),
    t('old-done', { status: 'done', date: '2026-11-10' }),
    t('tomorrow', { status: 'todo', date: '2026-11-20' }),
    t('spans', { status: 'todo', date: '2026-11-18', endDate: '2026-11-20' }),
  ];
  it('counts today\'s done and open, and the older ones waiting', () => {
    expect(taskProgress(tasks, undefined, NOW)).toEqual({ carried: 1, done: 1, open: 3 });
  });
  it('a task that spans today is today\'s, not late', () => {
    expect(taskProgress([tasks[7]], undefined, NOW)).toEqual({ carried: 0, done: 0, open: 1 });
  });
});

describe('oldestCarried', () => {
  it('is the one that has waited longest', () => {
    const list = [t('a', { date: '2026-11-15' }), t('b', { date: '2026-11-02' }), t('c', { date: '2026-11-19' })];
    expect(oldestCarried(list, undefined, NOW)?.id).toBe('b');
  });
  it('is null when nothing is behind', () => {
    expect(oldestCarried([t('c', { date: '2026-11-19' }), t('d', { status: 'done', date: '2026-11-01' })], undefined, NOW)).toBeNull();
  });
});
