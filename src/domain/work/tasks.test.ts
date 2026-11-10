import { describe, it, expect } from 'vitest';
import {
  addDays, blankTask, compareTasks, coversDay, dayKey, filterTasks, groupByStatus, isOverdue, lastDayOf, monthGrid, moveToStatus,
  nextTaskNo, parseDayKey, sortTasks,
} from '@/domain/work/tasks';
import { normalizeTask } from '@/domain/work/sharing';
import type { Task } from '@/domain/work/types';

const task = (over: Partial<Task> = {}): Task => normalizeTask({ id: 'x', no: 1, title: 'Task', ...over });

const NOW = new Date(2026, 10, 9, 15, 30); // Mon 9 Nov 2026, local

describe('days', () => {
  it('writes a day as YYYY-MM-DD in local time', () => {
    expect(dayKey(NOW)).toBe('2026-11-09');
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
  it('reads one back and moves it across month ends', () => {
    expect(dayKey(parseDayKey('2026-03-01'))).toBe('2026-03-01');
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('ordering', () => {
  it('puts high priority first, then the sooner date, then the older task', () => {
    const a = task({ id: 'a', no: 1, priority: 'low', date: '2026-11-01' });
    const b = task({ id: 'b', no: 2, priority: 'high', date: '2026-11-20' });
    const c = task({ id: 'c', no: 3, priority: 'high', date: '2026-11-10' });
    const d = task({ id: 'd', no: 4, priority: 'high', date: '2026-11-10' });
    expect(sortTasks([a, b, d, c]).map((t) => t.id)).toEqual(['c', 'd', 'b', 'a']);
  });
  it('ranks no priority after low, and undated after dated', () => {
    expect(compareTasks(task({ priority: null }), task({ priority: 'low' }))).toBeGreaterThan(0);
    expect(compareTasks(task({ date: null, no: 1 }), task({ date: '2026-11-01', no: 2 }))).toBeGreaterThan(0);
  });
});

describe('groupByStatus', () => {
  it('fills each status in order', () => {
    const groups = groupByStatus([
      task({ id: 'a', status: 'done' }), task({ id: 'b', status: 'todo', no: 2 }), task({ id: 'c', status: 'todo', no: 3, priority: 'high' }),
    ]);
    expect(groups.todo.map((t) => t.id)).toEqual(['c', 'b']);
    expect(groups.done.map((t) => t.id)).toEqual(['a']);
    expect(groups.doing).toEqual([]);
    expect(groups.dropped).toEqual([]);
  });
});

describe('moveToStatus', () => {
  it('stamps when a task is finished, and keeps the first time if it is moved within done', () => {
    const moved = moveToStatus(task({ status: 'doing' }), 'done', NOW);
    expect(moved.status).toBe('done');
    expect(moved.doneAt).toBe(NOW.toISOString());
    const again = moveToStatus(task({ status: 'done', doneAt: '2026-11-02T00:00:00.000Z' }), 'done', NOW);
    expect(again.doneAt).toBe('2026-11-02T00:00:00.000Z');
  });
  it('clears it when the task is reopened or dropped', () => {
    expect(moveToStatus(task({ status: 'done', doneAt: 'x' }), 'doing', NOW).doneAt).toBeNull();
    expect(moveToStatus(task({ status: 'done', doneAt: 'x' }), 'dropped', NOW).doneAt).toBeNull();
  });
});

describe('isOverdue', () => {
  it('is an open task dated before today', () => {
    expect(isOverdue(task({ date: '2026-11-08' }), '2026-11-09')).toBe(true);
    expect(isOverdue(task({ date: '2026-11-09' }), '2026-11-09')).toBe(false);
    expect(isOverdue(task({ date: '2026-11-08', status: 'done' }), '2026-11-09')).toBe(false);
    expect(isOverdue(task({ date: null }), '2026-11-09')).toBe(false);
  });
});

describe('filterTasks', () => {
  const list = [
    task({ id: 'today', date: '2026-11-09', title: 'Write the report' }),
    task({ id: 'tomorrow', date: '2026-11-10', projectId: 'p1' }),
    task({ id: 'late', date: '2026-11-01' }),
    task({ id: 'late-done', date: '2026-11-01', status: 'done' }),
    task({ id: 'none', date: null, assignee: 'Omar' }),
  ];
  const ids = (f: Parameters<typeof filterTasks>[1]) => filterTasks(list, f, NOW).map((t) => t.id);

  it('"today" follows the date it is asked on', () => {
    expect(ids({ day: { kind: 'today' } })).toEqual(['today']);
    expect(filterTasks(list, { day: { kind: 'today' } }, new Date(2026, 10, 10)).map((t) => t.id)).toEqual(['tomorrow']);
  });
  it('a chosen day, overdue and undated', () => {
    expect(ids({ day: { kind: 'day', day: '2026-11-10' } })).toEqual(['tomorrow']);
    expect(ids({ day: { kind: 'overdue' } })).toEqual(['late']);
    expect(ids({ day: { kind: 'undated' } })).toEqual(['none']);
  });
  it('narrows by status, project, assignee and a word in the title', () => {
    expect(ids({ day: { kind: 'all' }, statuses: ['done'] })).toEqual(['late-done']);
    expect(ids({ day: { kind: 'all' }, projectId: 'p1' })).toEqual(['tomorrow']);
    expect(ids({ day: { kind: 'all' }, projectId: 'none' })).toHaveLength(4);
    expect(ids({ day: { kind: 'all' }, assignee: 'Omar' })).toEqual(['none']);
    expect(ids({ day: { kind: 'all' }, query: ' REPORT ' })).toEqual(['today']);
  });
});

describe('nextTaskNo / blankTask', () => {
  it('goes one past the highest, starting at 1', () => {
    expect(nextTaskNo([])).toBe(1);
    expect(nextTaskNo([task({ no: 4 }), task({ no: 9 })])).toBe(10);
  });
  it('makes an empty to-do dated for the day asked', () => {
    const blank = blankTask(7, '2026-11-09', NOW);
    expect(blank).toMatchObject({ no: 7, status: 'todo', date: '2026-11-09', title: '', doneAt: null });
  });
});

describe('monthGrid', () => {
  it('has whole weeks, Saturday first', () => {
    // November 2026 starts on a Sunday: the first week is Sat 31 Oct … Fri 6 Nov.
    const weeks = monthGrid(2026, 10);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0][0]).toEqual({ key: '2026-10-31', inMonth: false });
    expect(weeks[0][1]).toEqual({ key: '2026-11-01', inMonth: true });
    expect(weeks[weeks.length - 1][6].key).toBe('2026-12-04');
  });
  it('does not add a spare week when the month ends on a Friday', () => {
    // October 2026 ends on a Saturday; March 2026 ends on a Tuesday — both just need to end inside their last week.
    for (const [y, m] of [[2026, 9], [2026, 2], [2027, 1]]) {
      const weeks = monthGrid(y, m);
      const lastDay = new Date(y, m + 1, 0);
      expect(weeks.flat().some((d) => d.key === dayKey(lastDay))).toBe(true);
      expect(weeks[weeks.length - 1].some((d) => d.inMonth)).toBe(true);
    }
  });
});

describe('tasks that span days', () => {
  const span = { date: '2026-11-10', endDate: '2026-11-12' };
  it('cover every day from the start to the end', () => {
    expect(coversDay(span, '2026-11-09')).toBe(false);
    expect(coversDay(span, '2026-11-10')).toBe(true);
    expect(coversDay(span, '2026-11-11')).toBe(true);
    expect(coversDay(span, '2026-11-12')).toBe(true);
    expect(coversDay(span, '2026-11-13')).toBe(false);
  });
  it('are one day when they have no end (or an end before the start)', () => {
    expect(coversDay({ date: '2026-11-10', endDate: null }, '2026-11-11')).toBe(false);
    expect(lastDayOf({ date: '2026-11-10', endDate: '2026-11-09' })).toBe('2026-11-10');
  });
  it('are late only after their last day', () => {
    const t = normalizeTask({ id: 'x', status: 'doing', ...span });
    expect(isOverdue(t, '2026-11-12')).toBe(false);
    expect(isOverdue(t, '2026-11-13')).toBe(true);
  });
  it('show under today while today is within them', () => {
    const t = normalizeTask({ id: 'x', ...span });
    expect(filterTasks([t], { day: { kind: 'today' } }, new Date(2026, 10, 11))).toHaveLength(1);
    expect(filterTasks([t], { day: { kind: 'today' } }, new Date(2026, 10, 14))).toHaveLength(0);
  });
});
