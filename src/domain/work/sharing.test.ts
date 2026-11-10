import { describe, it, expect } from 'vitest';
import { isMineAsGuest, normalizeProject, normalizeTask, staleViewers, viewersOf } from '@/domain/work/sharing';
import type { Task } from '@/domain/work/types';

const task = (over: Partial<Task> = {}): Task => normalizeTask({ id: 't', ...over });

describe('viewersOf', () => {
  const shared = { memberUids: ['a', 'b'], guestsSeeAll: true };
  const private_ = { memberUids: ['a', 'b'], guestsSeeAll: false };

  it('shows every member the tasks of a project shared with everyone', () => {
    expect(viewersOf({ assigneeUid: 'a', createdByUid: null }, shared)).toEqual(['a', 'b']);
  });
  it('shows a member only their own tasks when the project does not share them', () => {
    expect(viewersOf({ assigneeUid: 'a', createdByUid: null }, private_)).toEqual(['a']);
    expect(viewersOf({ assigneeUid: 'a', createdByUid: 'b' }, private_)).toEqual(['a', 'b']);
  });
  it('shows nobody a task that is not for a member', () => {
    expect(viewersOf({ assigneeUid: 'x', createdByUid: null }, private_)).toEqual([]);
    expect(viewersOf({ assigneeUid: null, createdByUid: null }, private_)).toEqual([]);
  });
  it('shows a task with no project to who it is for and who made it', () => {
    expect(viewersOf({ assigneeUid: 'a', createdByUid: 'a' }, null)).toEqual(['a']);
    expect(viewersOf({ assigneeUid: null, createdByUid: null }, null)).toEqual([]);
  });
});

describe('isMineAsGuest', () => {
  it('is a task for them or made by them', () => {
    expect(isMineAsGuest({ assigneeUid: 'a', createdByUid: null }, 'a')).toBe(true);
    expect(isMineAsGuest({ assigneeUid: null, createdByUid: 'a' }, 'a')).toBe(true);
    expect(isMineAsGuest({ assigneeUid: 'b', createdByUid: 'b' }, 'a')).toBe(false);
  });
});

describe('staleViewers', () => {
  it('lists only the tasks whose viewers changed with the project sharing', () => {
    const tasks = [
      task({ id: '1', assigneeUid: 'a', viewerUids: ['a'] }),
      task({ id: '2', assigneeUid: 'a', viewerUids: ['a', 'b'] }),
    ];
    expect(staleViewers(tasks, { memberUids: ['a', 'b'], guestsSeeAll: true })).toEqual([{ id: '1', viewerUids: ['a', 'b'] }]);
    expect(staleViewers(tasks, { memberUids: ['a', 'b'], guestsSeeAll: false })).toEqual([{ id: '2', viewerUids: ['a'] }]);
  });
  it('is empty when nothing changed', () => {
    expect(staleViewers([task({ assigneeUid: 'a', viewerUids: ['a'] })], { memberUids: ['a'], guestsSeeAll: false })).toEqual([]);
  });
});

describe('normalize', () => {
  it('fills what an older record lacks', () => {
    expect(normalizeTask({ id: 'x', title: 'T' })).toMatchObject({ title: 'T', viewerUids: [], assigneeUid: null, createdByUid: null, tags: [] });
    expect(normalizeProject({ id: 'p', name: 'P' })).toMatchObject({ memberUids: [], guestsSeeAll: false });
  });
  it('keeps what the record has', () => {
    expect(normalizeProject({ id: 'p', memberUids: ['a'], guestsSeeAll: true })).toMatchObject({ memberUids: ['a'], guestsSeeAll: true });
  });
});
