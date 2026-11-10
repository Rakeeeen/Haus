import { describe, it, expect } from 'vitest';
import { compareProjects, countTasks, filterProjectsByStatus, groupProjects, spreadMonthLabels, projectLabel, isWorkedOn, monthStarts, progressOf, projectSpan, tasksByProject } from '@/domain/work/projects';
import { normalizeProject, normalizeTask } from '@/domain/work/sharing';
import type { Project, Task } from '@/domain/work/types';

const task = (over: Partial<Task> = {}): Task => normalizeTask({ id: 'x', no: 1, title: 'Task', ...over });
const project = (over: Partial<Project> = {}): Project => normalizeProject({ id: 'p', name: 'P', ...over });

describe('progressOf', () => {
  it('is the share of finished tasks, leaving out the dropped ones', () => {
    expect(progressOf([task({ status: 'done' }), task({ status: 'done' }), task({ status: 'todo' }), task({ status: 'doing' })])).toBe(0.5);
    expect(progressOf([task({ status: 'done' }), task({ status: 'dropped' })])).toBe(1);
  });
  it('is 0 with no tasks, or only dropped ones', () => {
    expect(progressOf([])).toBe(0);
    expect(progressOf([task({ status: 'dropped' })])).toBe(0);
  });
  it('moves when a task is finished', () => {
    const open = task({ status: 'doing', id: 'a' });
    expect(progressOf([open, task({ status: 'done', id: 'b' })])).toBe(0.5);
    expect(progressOf([{ ...open, status: 'done' }, task({ status: 'done', id: 'b' })])).toBe(1);
  });
});

describe('countTasks / tasksByProject', () => {
  it('counts without the dropped ones', () => {
    expect(countTasks([task({ status: 'done' }), task({ status: 'todo' }), task({ status: 'dropped' })])).toEqual({ total: 2, done: 1, open: 1 });
  });
  it('groups by project and leaves out tasks with none', () => {
    const map = tasksByProject([task({ id: 'a', projectId: 'p1' }), task({ id: 'b', projectId: 'p1' }), task({ id: 'c', projectId: 'p2' }), task({ id: 'd' })]);
    expect(map.get('p1')?.map((t) => t.id)).toEqual(['a', 'b']);
    expect(map.get('p2')?.map((t) => t.id)).toEqual(['c']);
    expect(map.size).toBe(2);
  });
});

describe('isWorkedOn', () => {
  it('is in progress or in maintenance', () => {
    expect(isWorkedOn(project({ status: 'active' }))).toBe(true);
    expect(isWorkedOn(project({ status: 'maintenance' }))).toBe(true);
    expect(isWorkedOn(project({ status: 'paused' }))).toBe(false);
    expect(isWorkedOn(project({ status: 'done' }))).toBe(false);
  });
});

describe('projectLabel', () => {
  const names: Record<string, string> = { a: 'Alpha', b: 'Beta' };
  it('joins the names of the projects the task is in', () => {
    expect(projectLabel(task({ projectIds: ['a', 'b'] }), (id) => names[id] ?? null)).toBe('Alpha · Beta');
  });
  it('leaves out a project the viewer cannot see, and is null when none shows', () => {
    expect(projectLabel(task({ projectIds: ['a', 'x'] }), (id) => names[id] ?? null)).toBe('Alpha');
    expect(projectLabel(task({ projectIds: ['x'] }), (id) => names[id] ?? null)).toBeNull();
    expect(projectLabel(task({}), (id) => names[id] ?? null)).toBeNull();
  });
});

describe('filterProjectsByStatus', () => {
  const list = [project({ id: 'a', status: 'active' }), project({ id: 'b', status: 'planning' }), project({ id: 'c', status: 'done' })];
  it('keeps the projects in any of the chosen statuses', () => {
    expect(filterProjectsByStatus(list, ['active']).map((p) => p.id)).toEqual(['a']);
    expect(filterProjectsByStatus(list, ['done', 'active']).map((p) => p.id)).toEqual(['a', 'c']);
  });
  it('keeps them all when none is chosen', () => {
    expect(filterProjectsByStatus(list, [])).toHaveLength(3);
  });
});

describe('compareProjects / groupProjects', () => {
  it('puts the newest first, undated last', () => {
    const list = [project({ id: 'a', date: '2026-01-01' }), project({ id: 'b', date: null }), project({ id: 'c', date: '2026-06-01' })];
    expect([...list].sort(compareProjects).map((p) => p.id)).toEqual(['c', 'a', 'b']);
  });
  it('groups by status in the status order, dropping empty groups', () => {
    const groups = groupProjects([project({ id: 'a', status: 'paused' }), project({ id: 'b', status: 'active' }), project({ id: 'c', status: 'paused' })], 'status', () => null);
    expect(groups.map((g) => g.label)).toEqual(['In progress', 'On hold']);
    expect(groups[1].projects.map((p) => p.id).sort()).toEqual(['a', 'c']);
  });
  it('groups by client, A to Z, with no client last', () => {
    const clients: Record<string, string | null> = { a: 'Zed', b: 'Amr', c: null };
    const groups = groupProjects([project({ id: 'a' }), project({ id: 'b' }), project({ id: 'c' })], 'client', (id) => clients[id]);
    expect(groups.map((g) => g.label)).toEqual(['Amr', 'Zed', 'No client']);
  });
});

describe('spreadMonthLabels', () => {
  const m = (offset: number) => ({ key: String(offset), label: String(offset), offset });
  it('keeps labels that are far enough apart', () => {
    expect(spreadMonthLabels([m(0), m(30), m(61)], 20).map((x) => x.offset)).toEqual([0, 30, 61]);
  });
  it('drops a label that would print on the one before', () => {
    expect(spreadMonthLabels([m(0), m(30), m(40), m(70)], 20).map((x) => x.offset)).toEqual([0, 30, 70]);
  });
  it('lets a sliver of a first month give way to the next one', () => {
    // the first month began before the chart (offset -20, drawn at 0) and the next starts 14 days in
    expect(spreadMonthLabels([m(-20), m(14), m(45)], 20).map((x) => x.offset)).toEqual([14, 45]);
  });
});

describe('projectSpan', () => {
  const today = '2026-11-09';
  it('runs from the project date to its last task', () => {
    expect(projectSpan(project({ status: 'done', date: '2026-03-01' }), [task({ date: '2026-03-20' }), task({ date: '2026-04-02' })], today))
      .toEqual({ from: '2026-03-01', to: '2026-04-02' });
  });
  it('carries on to today while the project is being worked on', () => {
    expect(projectSpan(project({ status: 'active', date: '2026-10-01' }), [task({ date: '2026-10-05' })], today)).toEqual({ from: '2026-10-01', to: today });
  });
  it('starts from the first task when the project has no date', () => {
    expect(projectSpan(project({ status: 'paused', date: null }), [task({ date: '2026-06-10' }), task({ date: '2026-06-30' })], today))
      .toEqual({ from: '2026-06-10', to: '2026-06-30' });
  });
  it('is at least a week long, and sits on today when it has nothing at all', () => {
    expect(projectSpan(project({ status: 'done', date: '2026-03-01' }), [], today)).toEqual({ from: '2026-03-01', to: '2026-03-08' });
    expect(projectSpan(project({ status: 'planning', date: null }), [], today)).toEqual({ from: today, to: '2026-11-16' });
  });
});

describe('monthStarts', () => {
  it('lists the first of each month in the range with its offset in days', () => {
    expect(monthStarts('2026-01-20', '2026-03-05').map((m) => [m.key, m.offset])).toEqual([['2026-01-01', -19], ['2026-02-01', 12], ['2026-03-01', 40]]);
  });
});
