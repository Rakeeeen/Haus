// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Firestore, replaced: what this device holds (`cache`), and every listener opened, which a test answers for the server.
type FakeDoc = { id: string; data: () => Record<string, unknown> };
type Change = { type: 'added' | 'modified' | 'removed'; doc: FakeDoc };
type Listener = { q: { name: string; where?: { field: string; value: unknown } }; next: (snap: unknown) => void; error: (e: Error) => void; stopped: boolean };
let cache: Record<string, FakeDoc[]> = {};
let listeners: Listener[] = [];
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ name }),
  query: (c: { name: string }, w: { field: string; value: unknown }) => ({ ...c, where: w }),
  where: (field: string, _op: string, value: unknown) => ({ field, value }),
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  setDoc: vi.fn(async () => {}),
  getDocsFromCache: async (ref: { name: string }) => ({ docs: cache[ref.name] ?? [] }),
  onSnapshot: (q: Listener['q'], next: Listener['next'], error: Listener['error']) => {
    const l: Listener = { q, next, error, stopped: false };
    listeners.push(l);
    return () => { l.stopped = true; };
  },
}));
vi.mock('@/data/firebase', () => ({ db: {} }));

import { syncCollection } from '@/data/deltaSync';
import { SYNC_MARGIN_MS } from '@/domain/sync';

const fake = (id: string, updatedAt: string, extra: Record<string, unknown> = {}): FakeDoc => ({ id, data: () => ({ updatedAt, ...extra }) });
const server = (docs: FakeDoc[], changes: Change[] = []) => ({ metadata: { fromCache: false }, size: docs.length, docs, docChanges: () => changes });
const flush = () => new Promise((r) => setTimeout(r, 0));
const live = () => listeners.filter((l) => !l.stopped);
const ids = (docs: FakeDoc[]) => docs.map((d) => d.id);

beforeEach(() => { cache = {}; listeners = []; localStorage.clear(); });

describe('syncCollection', () => {
  it('the first time, listens to the whole collection and remembers it read it all', async () => {
    const seen: string[][] = [];
    syncCollection('work_tasks', (docs) => seen.push(ids(docs as never)), () => {});
    await flush();
    expect(live().map((l) => l.q)).toEqual([{ name: 'work_tasks' }]);
    live()[0].next(server([fake('a', '2026-11-10T10:00:00.000Z'), fake('b', '2026-11-10T11:00:00.000Z')]));
    expect(seen[seen.length - 1]).toEqual(['a', 'b']);
    expect(JSON.parse(localStorage.getItem('haus:sync:work_tasks')!)).toMatchObject({ count: 2 });
  });

  it('after that, shows what this device holds and asks only for what changed since its newest, and for what was deleted', async () => {
    localStorage.setItem('haus:sync:work_tasks', JSON.stringify({ fullAt: Date.now(), count: 3 }));
    cache.work_tasks = [fake('c', '2026-11-10T09:00:00.000Z'), fake('a', '2026-11-10T12:00:00.000Z'), fake('b', '2026-11-09T12:00:00.000Z'), fake('gone', '2026-11-08T00:00:00.000Z')];
    cache.work_tasks_deleted = [fake('gone', '')];
    const seen: string[][] = [];
    syncCollection('work_tasks', (docs) => seen.push(ids(docs as never)), () => {});
    await flush();

    // At once, from this device: in id order, without the one already known to be deleted.
    expect(seen[0]).toEqual(['a', 'b', 'c']);
    const since = new Date(Date.parse('2026-11-10T12:00:00.000Z') - SYNC_MARGIN_MS).toISOString();
    const [changes, deleted] = live();
    expect(changes.q).toEqual({ name: 'work_tasks', where: { field: 'updatedAt', value: since } });
    expect(deleted.q).toEqual({ name: 'work_tasks_deleted', where: { field: 'at', value: since } });

    // The server: one new, one changed, one deleted elsewhere.
    changes.next(server([], [{ type: 'added', doc: fake('d', '2026-11-11T08:00:00.000Z') }, { type: 'modified', doc: fake('a', '2026-11-11T08:01:00.000Z', { title: 'new' }) }]));
    expect(seen[seen.length - 1]).toEqual(['a', 'b', 'c', 'd']);
    deleted.next(server([fake('b', '')]));
    expect(seen[seen.length - 1]).toEqual(['a', 'c', 'd']);
  });

  it('reads everything when this device holds fewer documents than the list had', async () => {
    localStorage.setItem('haus:sync:work_tasks', JSON.stringify({ fullAt: Date.now(), count: 5 }));
    cache.work_tasks = [fake('a', '2026-11-10T12:00:00.000Z')];
    syncCollection('work_tasks', () => {}, () => {});
    await flush();
    expect(live().map((l) => l.q)).toEqual([{ name: 'work_tasks' }]);
  });

  it('falls back to the whole collection when what was deleted can\'t be read (rules not deployed yet)', async () => {
    localStorage.setItem('haus:sync:work_tasks', JSON.stringify({ fullAt: Date.now(), count: 1 }));
    cache.work_tasks = [fake('a', '2026-11-10T12:00:00.000Z')];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    syncCollection('work_tasks', () => {}, () => {});
    await flush();
    live()[1].error(new Error('permission-denied'));
    expect(live().map((l) => l.q)).toEqual([{ name: 'work_tasks' }]);
    warn.mockRestore();
  });

  it('stops every listener when it is stopped', async () => {
    const stop = syncCollection('work_tasks', () => {}, () => {});
    await flush();
    stop();
    expect(live()).toEqual([]);
  });
});
