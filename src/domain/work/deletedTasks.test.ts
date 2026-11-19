import { describe, it, expect } from 'vitest';
import { KEEP_MS, MAX_KEPT, asNewTask, forget, isDeletedList, remember, restorable } from '@/domain/work/deletedTasks';
import { blankTask } from '@/domain/work/tasks';
import type { Task } from '@/domain/work/types';

const t = (id: string, title = id): Task => ({ ...blankTask(1, '2026-11-19'), id, title });

describe('remember / forget / restorable', () => {
  it('keeps the most recent first, once per task', () => {
    let list = remember([], t('a'), 100);
    list = remember(list, t('b'), 200);
    list = remember(list, t('a', 'a again'), 300);
    expect(restorable(list, 300).map((e) => e.task.title)).toEqual(['a again', 'b']);
  });
  it('keeps a bounded number', () => {
    let list = [] as ReturnType<typeof remember>;
    for (let i = 0; i < MAX_KEPT + 5; i++) list = remember(list, t(`t${i}`), i);
    expect(list).toHaveLength(MAX_KEPT);
    expect(list[0].task.id).toBe(`t${MAX_KEPT + 4}`);
  });
  it('lets old ones go', () => {
    const list = remember(remember([], t('old'), 0), t('new'), KEEP_MS + 5);
    expect(restorable(list, KEEP_MS + 10).map((e) => e.task.id)).toEqual(['new']);
  });
  it('forgets one', () => {
    expect(forget(remember([], t('a'), 1), 'a')).toEqual([]);
  });
});

describe('asNewTask', () => {
  it('is the task without its id and number, changed just now', () => {
    const made = asNewTask({ ...t('x', 'Pay rent'), status: 'doing', date: '2026-11-20' }, new Date('2026-11-19T10:00:00Z'));
    expect(made).toMatchObject({ title: 'Pay rent', status: 'doing', date: '2026-11-20', updatedAt: '2026-11-19T10:00:00.000Z' });
    expect(made).not.toHaveProperty('id');
    expect(made).not.toHaveProperty('no');
  });
});

describe('isDeletedList', () => {
  it('accepts what remember makes and rejects the rest', () => {
    expect(isDeletedList(remember([], t('a'), 1))).toBe(true);
    expect(isDeletedList([{ at: 'x', task: {} }])).toBe(false);
    expect(isDeletedList('nope')).toBe(false);
  });
});
