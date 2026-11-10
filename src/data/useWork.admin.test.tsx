// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A project's admin writes tasks the rules will check, so what they send is pinned here: who the task is for, who may see it,
// and that it is stamped as theirs.
const db = vi.hoisted(() => ({
  data: {} as Record<string, Array<{ id: string; [k: string]: unknown }>>,
  writes: [] as Array<{ path: string; body: Record<string, unknown>; merge: boolean }>,
}));

vi.mock('@/data/firebase', () => ({ db: {} }));
vi.mock('@/lib/sound', () => ({ playTaskDone: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  doc: (parent: { path: string } | unknown, ...path: string[]) => ({ path: [(parent as { path?: string }).path ?? '', ...path].filter(Boolean).join('/'), id: `new-${db.writes.length}` }),
  query: (ref: unknown) => ref,
  where: () => ({}),
  orderBy: () => ({}),
  onSnapshot: (ref: { path: string }, next: (snap: { docs: unknown[] }) => void) => {
    next({ docs: (db.data[ref.path] ?? []).map(({ id, ...rest }) => ({ id, data: () => rest })) });
    return () => {};
  },
  setDoc: async (ref: { path: string }, body: Record<string, unknown>, options?: { merge?: boolean }) => { db.writes.push({ path: ref.path, body, merge: !!options?.merge }); },
  deleteDoc: vi.fn(),
  writeBatch: () => ({ set: (ref: { path: string }, body: Record<string, unknown>) => db.writes.push({ path: ref.path, body, merge: true }), delete: vi.fn(), commit: async () => {} }),
}));

import { WorkProvider, useWork } from '@/data/useWork';

const last = () => db.writes[db.writes.length - 1];
const project = { id: 'p', name: 'Brand', memberUids: ['a', 'b', 'c'], adminUids: ['b'], guestsSeeAll: false, memberProfiles: {} };
const task = { id: 't1', title: 'Old', projectId: 'p', projectIds: ['p'], assigneeUids: ['a'], assigneeUid: 'a', createdByUid: null, viewerUids: ['a', 'b'] };

const render = (uid: string) => renderHook(() => useWork(), {
  wrapper: ({ children }) => <WorkProvider scope={{ kind: 'guest', uid, name: 'Guest' }}>{children}</WorkProvider>,
});

beforeEach(() => {
  db.data = { work_projects: [project], work_tasks: [task] };
  db.writes = [];
});

describe('a project admin (a guest)', () => {
  it('may change and delete any task of the project; a plain member only their own', async () => {
    const admin = render('b');
    await waitFor(() => expect(admin.result.current.ready).toBe(true));
    expect(admin.result.current.canEditTask(admin.result.current.tasks[0])).toBe(true);
    expect(admin.result.current.canDeleteTask(admin.result.current.tasks[0])).toBe(true);
    expect(admin.result.current.isProjectAdmin('p')).toBe(true);

    const member = render('c');
    await waitFor(() => expect(member.result.current.ready).toBe(true));
    expect(member.result.current.canEditTask(member.result.current.tasks[0])).toBe(false);
    expect(member.result.current.canDeleteTask(member.result.current.tasks[0])).toBe(false);
    expect(member.result.current.isProjectAdmin('p')).toBe(false);
  });

  it('makes a task for another member: stamped as theirs, seen by that member and the admins', async () => {
    const { result } = render('b');
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await result.current.addTask({ title: 'Do it', projectId: 'p', projectIds: ['p'], assigneeUids: ['c'], assignee: 'Cleo' }); });
    const body = last().body;
    expect(body).toMatchObject({ no: 0, projectId: 'p', createdByUid: 'b', updatedByUid: 'b', assigneeUids: ['c'], assigneeUid: 'c', assignee: 'Cleo' });
    expect([...(body.viewerUids as string[])].sort()).toEqual(['b', 'c']);
    expect(body).not.toHaveProperty('projectIds');
  });

  it('cannot give a task to someone who is not on the project', async () => {
    const { result } = render('b');
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await result.current.addTask({ title: 'Do it', projectId: 'p', assigneeUids: ['stranger'] }); });
    expect(last().body.assigneeUids).toEqual(['b']);
  });

  it('gives a task to Hamed too', async () => {
    const { result } = render('b');
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await result.current.addTask({ title: 'For you', projectId: 'p', assigneeUids: ['owner'] }); });
    expect(last().body).toMatchObject({ assigneeUids: ['owner'], assigneeUid: null });
  });

  it('changes who a task is for, with who sees it, and says it was them', async () => {
    const { result } = render('b');
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await result.current.updateTask('t1', { title: 'New', assigneeUids: ['c'] }); });
    const write = last();
    expect(write.merge).toBe(true);
    expect(write.body).toMatchObject({ title: 'New', assigneeUids: ['c'], assigneeUid: 'c', updatedByUid: 'b' });
    expect([...(write.body.viewerUids as string[])].sort()).toEqual(['b', 'c']);
  });

  it('changes the project\'s name and dates, and nothing else of it', async () => {
    const { result } = render('b');
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await result.current.updateProject('p', { name: 'Renamed', memberUids: ['x'], lead: 'Me' }); });
    const body = last().body;
    expect(body).toMatchObject({ name: 'Renamed' });
    expect(body).not.toHaveProperty('memberUids');
    expect(body).not.toHaveProperty('lead');
  });

  it('a plain member still changes only the usual fields of their own task', async () => {
    db.data.work_tasks = [{ ...task, assigneeUids: ['c'], assigneeUid: 'c', viewerUids: ['b', 'c'] }];
    const { result } = render('c');
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await result.current.updateTask('t1', { title: 'Mine', assigneeUids: ['a'] }); });
    const body = last().body;
    expect(body).toMatchObject({ title: 'Mine' });
    expect(body).not.toHaveProperty('assigneeUids');
    expect(body).not.toHaveProperty('updatedByUid');
  });
});

describe('Hamed', () => {
  it('clears the admin stamp when he changes a task himself', async () => {
    const { result } = renderHook(() => useWork(), { wrapper: ({ children }) => <WorkProvider scope={{ kind: 'owner' }}>{children}</WorkProvider> });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await result.current.updateTask('t1', { title: 'Mine now' }); });
    expect(last().body).toMatchObject({ title: 'Mine now', updatedByUid: null });
  });
});
