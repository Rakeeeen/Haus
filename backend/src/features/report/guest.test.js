import { describe, expect, it } from 'vitest';
import { buildGuestReport, buildGuestTasks } from './guest.js';
import { buildFocus, buildWater } from './data.js';
import { afterGuestAttempt, guestsDue, MAX_ATTEMPTS } from './schedule.js';

// Tuesday 10 Nov 2026, 19:00.
const now = new Date(2026, 10, 10, 19, 0, 0);
const task = (id, extra = {}) => ({ id, title: `Task ${id}`, status: 'todo', date: null, endDate: null, doneAt: null, ...extra });

describe('a guest report uses the same water and focus rules as Hamed\'s', () => {
  const raw = {
    glasses: 0, hydrationHistory: {}, dailyHistory: { '2026-11-10': { water: 7, focus: 95 } },
    pomodoroWeek: null, pomodoroHistory: {}, pomodoroLogs: [], tasks: [],
  };
  it('reads the same numbers from the same values', () => {
    const report = buildGuestReport(raw, { name: 'Mona' }, now);
    expect(report.water.glasses).toBe(buildWater(raw, now).glasses);
    expect(report.water.glasses).toBe(7);
    expect(report.focus.minutes).toBe(buildFocus(raw, now).minutes);
    expect(report.focus.minutes).toBe(95);
  });
  it('is about that person, and has no money in it', () => {
    const report = buildGuestReport(raw, { name: 'Mona' }, now);
    expect(report.person.name).toBe('Mona');
    expect(report).not.toHaveProperty('finance');
    expect(report.highlights.some((h) => /Payit|Thndr|buckets/.test(h.text))).toBe(false);
  });
});

describe('buildGuestTasks', () => {
  const tasks = [
    task('done-today', { status: 'done', doneAt: new Date(2026, 10, 10, 12).toISOString() }),
    task('done-before', { status: 'done', doneAt: new Date(2026, 10, 9, 12).toISOString() }),
    task('late', { status: 'doing', date: '2026-11-05', endDate: '2026-11-08' }),
    task('due-today', { date: '2026-11-10' }),
    task('spans-today', { date: '2026-11-09', endDate: '2026-11-12' }),
    task('later', { date: '2026-11-20' }),
    task('no-date'),
    task('dropped', { status: 'dropped', date: '2026-11-01' }),
  ];
  const result = buildGuestTasks(tasks, now);
  it('counts only what was finished today', () => { expect(result.doneToday).toEqual(['Task done-today']); expect(result.doneCount).toBe(1); });
  it('counts open ones, and late is open with its last day passed', () => {
    expect(result.openCount).toBe(5); // not the finished ones, nor the dropped one
    expect(result.late).toEqual(['Task late']);
  });
  it('lists what is due today, including a task that spans today', () => {
    expect(result.dueToday).toEqual(['Task due-today', 'Task spans-today']);
  });
  it('copes with no tasks at all', () => {
    expect(buildGuestTasks(undefined, now)).toMatchObject({ doneCount: 0, openCount: 0, lateCount: 0 });
  });
});

describe('guestsDue', () => {
  const afterMaghrib = new Date(2026, 10, 10, 18, 5);
  const beforeMaghrib = new Date(2026, 10, 10, 17, 0);
  it('is nobody before Maghrib', () => {
    expect(guestsDue({ now: beforeMaghrib, maghrib: '17:30', state: null, uids: ['a', 'b'] })).toEqual([]);
  });
  it('is everyone after Maghrib on a fresh day, and only who is left after some were sent', () => {
    expect(guestsDue({ now: afterMaghrib, maghrib: '17:30', state: null, uids: ['a', 'b'] })).toEqual(['a', 'b']);
    const state = afterGuestAttempt(null, afterMaghrib, 'a', true);
    expect(guestsDue({ now: afterMaghrib, maghrib: '17:30', state, uids: ['a', 'b'] })).toEqual(['b']);
  });
  it('forgets yesterday, and gives up on a guest after too many failures', () => {
    const yesterday = afterGuestAttempt(null, new Date(2026, 10, 9, 18, 5), 'a', true);
    expect(guestsDue({ now: afterMaghrib, maghrib: '17:30', state: yesterday, uids: ['a'] })).toEqual(['a']);
    let state = null;
    for (let i = 0; i < MAX_ATTEMPTS; i++) state = afterGuestAttempt(state, afterMaghrib, 'a', false);
    expect(guestsDue({ now: afterMaghrib, maghrib: '17:30', state, uids: ['a', 'b'] })).toEqual(['b']);
  });
});
