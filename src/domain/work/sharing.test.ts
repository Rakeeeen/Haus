import { describe, it, expect } from 'vitest';
import { isFor, isMineAsGuest, normalizeProject, normalizeTask, staleViewers, viewersOf } from '@/domain/work/sharing';
import type { Task } from '@/domain/work/types';

const task = (over: Partial<Task> = {}): Task => normalizeTask({ id: 't', ...over });

describe('viewersOf', () => {
  const shared = { memberUids: ['a', 'b'], guestsSeeAll: true };
  const private_ = { memberUids: ['a', 'b'], guestsSeeAll: false };

  it('shows every member the tasks of a project shared with everyone', () => {
    expect(viewersOf({ assigneeUids: ['a'], createdByUid: null }, [shared])).toEqual(['a', 'b']);
  });
  it('shows a member only their own tasks when the project does not share them', () => {
    expect(viewersOf({ assigneeUids: ['a'], createdByUid: null }, [private_])).toEqual(['a']);
    expect(viewersOf({ assigneeUids: ['a'], createdByUid: 'b' }, [private_])).toEqual(['a', 'b']);
  });
  it('shows nobody a task that is not for a member', () => {
    expect(viewersOf({ assigneeUids: ['x'], createdByUid: null }, [private_])).toEqual([]);
    expect(viewersOf({ assigneeUids: [], createdByUid: null }, [private_])).toEqual([]);
  });
  it('shows a task in several projects to what each of them allows, together', () => {
    const other = { memberUids: ['c'], guestsSeeAll: true };
    // 'c' is on the other project, which shares everything: they see the task; 'b' (on neither) does not.
    expect(viewersOf({ assigneeUids: ['a'], createdByUid: null }, [private_, other])).toEqual(['a', 'c']);
    expect(viewersOf({ assigneeUids: ['a'], createdByUid: null }, [shared, other])).toEqual(['a', 'b', 'c']);
  });
  it('shows a task for several guests to each of them, and never lists Hamed', () => {
    expect(viewersOf({ assigneeUids: ['owner', 'a', 'b'], createdByUid: null }, [shared])).toEqual(['a', 'b']);
    expect(viewersOf({ assigneeUids: ['owner', 'a', 'x'], createdByUid: null }, [private_])).toEqual(['a']);
  });
  it('shows a task with no project to who it is for and who made it', () => {
    expect(viewersOf({ assigneeUids: ['a'], createdByUid: 'a' }, [])).toEqual(['a']);
    expect(viewersOf({ assigneeUids: [], createdByUid: null }, [])).toEqual([]);
  });
});

describe('isFor', () => {
  it('is whether the person is among those the task is for', () => {
    expect(isFor({ assigneeUids: ['owner', 'a'] }, 'a')).toBe(true);
    expect(isFor({ assigneeUids: ['owner', 'a'] }, 'b')).toBe(false);
    expect(isFor({ assigneeUids: ['owner'] }, 'owner')).toBe(true);
  });
});

describe('isMineAsGuest', () => {
  it('is a task for them or made by them', () => {
    expect(isMineAsGuest({ assigneeUids: ['a'], createdByUid: null }, 'a')).toBe(true);
    expect(isMineAsGuest({ assigneeUids: [], createdByUid: 'a' }, 'a')).toBe(true);
    expect(isMineAsGuest({ assigneeUids: ['b'], createdByUid: 'b' }, 'a')).toBe(false);
  });
});

describe('staleViewers', () => {
  it('lists only the tasks whose viewers changed with the project sharing', () => {
    const tasks = [
      task({ id: '1', assigneeUid: 'a', viewerUids: ['a'], projectIds: ['p'] }),
      task({ id: '2', assigneeUid: 'a', viewerUids: ['a', 'b'], projectIds: ['p'] }),
    ];
    expect(staleViewers(tasks, { id: 'p', memberUids: ['a', 'b'], guestsSeeAll: true })).toEqual([{ id: '1', viewerUids: ['a', 'b'] }]);
    expect(staleViewers(tasks, { id: 'p', memberUids: ['a', 'b'], guestsSeeAll: false })).toEqual([{ id: '2', viewerUids: ['a'] }]);
  });
  it('is empty when nothing changed', () => {
    expect(staleViewers([task({ assigneeUid: 'a', viewerUids: ['a'], projectIds: ['p'] })], { id: 'p', memberUids: ['a'], guestsSeeAll: false })).toEqual([]);
  });
});

describe('normalize', () => {
  it('fills what an older record lacks', () => {
    expect(normalizeTask({ id: 'x', title: 'T' })).toMatchObject({ title: 'T', viewerUids: [], assigneeUid: null, createdByUid: null, tags: [] });
    expect(normalizeProject({ id: 'p', name: 'P' })).toMatchObject({ memberUids: [], guestsSeeAll: false });
  });
  it('puts an older task\'s single project in the list, and keeps the first of several as its project', () => {
    expect(normalizeTask({ id: 'x', projectId: 'p' })).toMatchObject({ projectId: 'p', projectIds: ['p'] });
    expect(normalizeTask({ id: 'x', projectIds: ['q', 'p'] })).toMatchObject({ projectId: 'q', projectIds: ['q', 'p'] });
    expect(normalizeTask({ id: 'x' })).toMatchObject({ projectId: null, projectIds: [], endDate: null });
  });
  it('fills who a task is for: its guest, several, or Hamed when there was nobody', () => {
    expect(normalizeTask({ id: 'x', assigneeUid: 'a' }).assigneeUids).toEqual(['a']);
    expect(normalizeTask({ id: 'x', assigneeUids: ['owner', 'a'] }).assigneeUids).toEqual(['owner', 'a']);
    expect(normalizeTask({ id: 'x' }).assigneeUids).toEqual(['owner']);
  });
  it('keeps what the record has', () => {
    expect(normalizeProject({ id: 'p', memberUids: ['a'], guestsSeeAll: true })).toMatchObject({ memberUids: ['a'], guestsSeeAll: true });
  });
});
