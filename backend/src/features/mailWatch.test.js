import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startMailWatch } from './mailNotifications.js';

// The bot against a pretend Firestore: what it sends when it sees a change, and above all what it catches up on after being off.

const NOW = '2026-11-10T12:00:00Z';

function pretend(docs) {
  const watchers = {};
  const writes = [];
  const store = {
    getDocument: async (col, id) => docs[`${col}/${id}`] ?? null,
    setDocument: async (col, id, data) => { docs[`${col}/${id}`] = data; writes.push([col, id, data]); },
    watchCollection: (col, callback) => { watchers[col] = callback; watched.push([col, 'all']); },
    watchChangesSince: (col, field, since, callback) => { watchers[col] = callback; watched.push([col, `${field} > ${since}`]); },
    listWhereIn: async (col, field, values) => {
      lists.push([col, field, values]);
      return Object.entries(docs).filter(([key, d]) => key.startsWith(`${col}/`) && values.includes(d[field])).map(([key, d]) => ({ id: key.slice(col.length + 1), ...d }));
    },
  };
  const watched = [];
  const lists = [];
  /** One snapshot: `[type, id, data]` changes of a collection. */
  const snapshot = (col, changes) => watchers[col]({ docChanges: () => changes.map(([type, id, data]) => ({ type, doc: { id, data: () => data } })) });
  return { store, snapshot, writes, watched, lists };
}

const sent = [];
const mailer = { config: { ownerName: 'حامد', ownerEmail: 'hamed@x.co', appUrl: 'https://x/Haus/' }, send: vi.fn(async (mail) => { sent.push(mail); }) };

const GUESTS = {
  'guest_profiles/g1': { email: 'sara@x.co', name: 'Sara' }, 'members/sara@x.co': { email: 'sara@x.co', active: true, name: 'Sara' },
  'guest_profiles/g2': { email: 'omar@x.co', name: 'Omar' }, 'members/omar@x.co': { email: 'omar@x.co', active: true, name: 'Omar' },
  'work_projects/p': { name: 'Brand', memberUids: ['g1', 'g2'], adminUids: ['g2'] },
};
const task = (over) => ({ title: 'Do it', status: 'todo', projectId: 'p', createdAt: '2026-11-10T08:00:00Z', updatedAt: '2026-11-10T09:05:00Z', assigneeUids: ['owner'], ...over });

const start = async (docs) => {
  const world = pretend(docs);
  const watch = await startMailWatch({ mailer, store: world.store, batchMs: 1000, saveMs: 500 });
  return { ...world, ...watch };
};
const settle = async () => { await vi.advanceTimersByTimeAsync(2000); };
const to = (address) => sent.filter((m) => m.to === address);

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(NOW)); sent.length = 0; mailer.send.mockClear(); });
afterEach(() => vi.useRealTimers());

describe('the first time the bot ever runs', () => {
  it('counts every task already there as told, and mails nobody', async () => {
    const world = await start({ ...GUESTS });
    world.snapshot('work_tasks', [['added', 't1', task({ assigneeUids: ['owner', 'g1'] })]]);
    await settle();
    expect(sent).toEqual([]);
    expect(world.writes.at(-1)[2].told).toEqual({ t1: ['owner', 'g1'] });
  });
});

describe('a bot that has just begun', () => {
  it('mails a task made after its first look, though it began with nothing told', async () => {
    const world = await start({ ...GUESTS });
    world.snapshot('work_tasks', [['added', 'old', task({ assigneeUids: ['g1'] })]]); // what was there: not announced
    await settle();
    world.snapshot('work_tasks', [['added', 'new', task({ assigneeUids: ['owner'], createdByUid: 'g2', updatedByUid: 'g2' })]]);
    await settle();
    expect(to('sara@x.co')).toEqual([]);
    expect(to('hamed@x.co')).toHaveLength(1);
  });
});

describe('catching up on what happened while the bot was off', () => {
  const told = { 'mail_state/tasks': { told: { t1: ['owner'], t2: ['g1'] } } };

  it('mails a guest a task Hamed gave them while it was off, with the time it was given', async () => {
    const world = await start({ ...GUESTS, ...told });
    world.snapshot('work_tasks', [['added', 't1', task({ assigneeUids: ['owner', 'g1'], updatedByUid: null })], ['added', 't2', task({ assigneeUids: ['g1'] })]]);
    await settle();
    expect(to('sara@x.co')).toHaveLength(1);
    expect(to('sara@x.co')[0].html).toContain('الثلاثاء 10 نوفمبر، 11:05 ص');
    expect(to('sara@x.co')[0].subject).toBe('مهمة جديدة: Do it');
    expect(to('hamed@x.co')).toEqual([]); // his own doing: no notice to himself
  });

  it('does not tell the same person twice, across restarts', async () => {
    const world = await start({ ...GUESTS, ...told });
    world.snapshot('work_tasks', [['added', 't1', task({ assigneeUids: ['owner', 'g1'] })]]);
    await settle();
    const saved = world.writes.at(-1)[2];
    expect(saved.told.t1).toEqual(['owner', 'g1']);
    const again = await start({ ...GUESTS, 'mail_state/tasks': saved });
    again.snapshot('work_tasks', [['added', 't1', task({ assigneeUids: ['owner', 'g1'] })]]);
    await settle();
    expect(to('sara@x.co')).toHaveLength(1);
  });

  it('tells Hamed, and the one it is for, when a project admin gave a task while it was off', async () => {
    const world = await start({ ...GUESTS, 'mail_state/tasks': { told: {} } });
    world.snapshot('work_tasks', [['added', 't3', task({ assigneeUids: ['g1'], createdByUid: 'g2', updatedByUid: 'g2' })]]);
    await settle();
    expect(to('sara@x.co')).toHaveLength(1);
    expect(to('sara@x.co')[0].html).toContain('من Omar');
    expect(to('hamed@x.co')).toHaveLength(1);
    expect(to('hamed@x.co')[0].subject).toBe('مهمة جديدة: Do it من Omar إلى Sara');
    // A new task was made at its `createdAt`.
    expect(to('hamed@x.co')[0].html).toContain('الثلاثاء 10 نوفمبر، 10:00 ص');
  });

  it('tells Hamed when a project admin gave a task to him', async () => {
    const world = await start({ ...GUESTS, 'mail_state/tasks': { told: {} } });
    world.snapshot('work_tasks', [['added', 't4', task({ assigneeUids: ['owner'], createdByUid: 'g2', updatedByUid: 'g2' })]]);
    await settle();
    expect(to('hamed@x.co')).toHaveLength(1);
    expect(to('hamed@x.co')[0].subject).toBe('مهمة جديدة: Do it');
    expect(to('hamed@x.co')[0].html).toContain('من Omar');
    expect(to('sara@x.co')).toEqual([]);
  });

  it('says nothing for a task a guest gave themself, a finished one, or one given to someone not signed in', async () => {
    const world = await start({ ...GUESTS, 'mail_state/tasks': { told: {} } });
    world.snapshot('work_tasks', [
      ['added', 'a', task({ assigneeUids: ['g1'], createdByUid: 'g1' })],
      ['added', 'b', task({ assigneeUids: ['g1'], status: 'done' })],
      ['added', 'c', task({ assigneeUids: ['g9'] })],
    ]);
    await settle();
    expect(sent).toEqual([]);
  });

  it('sends one email for several tasks given at once', async () => {
    const world = await start({ ...GUESTS, 'mail_state/tasks': { told: {} } });
    world.snapshot('work_tasks', [1, 2, 3].map((n) => ['added', `t${n}`, task({ title: `Task ${n}`, assigneeUids: ['g1'] })]));
    await settle();
    expect(to('sara@x.co')).toHaveLength(1);
    expect(to('sara@x.co')[0].subject).toBe('3 مهام جديدة من حامد');
  });

  it('tells someone again when they are put back on a task', async () => {
    const world = await start({ ...GUESTS, 'mail_state/tasks': { told: { t1: ['g1'] } } });
    world.snapshot('work_tasks', [['modified', 't1', task({ assigneeUids: ['owner'] })]]);
    await settle();
    world.snapshot('work_tasks', [['modified', 't1', task({ assigneeUids: ['owner', 'g1'] })]]);
    await settle();
    expect(to('sara@x.co')).toHaveLength(1);
  });
});

describe('invitations', () => {
  const member = (addedAt) => ({ email: 'new@x.co', active: true, name: 'Nour', addedAt });

  it('mails one made while the bot was off, with when it was made, but not one from before it began', async () => {
    const world = await start({ 'mail_state/invites': { since: '2026-11-10T10:00:00Z' } });
    world.snapshot('members', [['added', 'new@x.co', member('2026-11-10T11:00:00Z')], ['added', 'old@x.co', { ...member('2026-11-01T11:00:00Z'), email: 'old@x.co' }]]);
    await settle();
    expect(to('new@x.co')).toHaveLength(1);
    expect(to('new@x.co')[0].html).toContain('تمت الدعوة');
    expect(to('old@x.co')).toEqual([]);
  });

  it('does not mail the same invitation twice', async () => {
    const world = await start({ 'mail_state/invites': { since: '2026-11-10T10:00:00Z' } });
    world.snapshot('members', [['added', 'new@x.co', member('2026-11-10T11:00:00Z')]]);
    await settle();
    world.snapshot('members', [['modified', 'new@x.co', member('2026-11-10T11:00:00Z')]]);
    await settle();
    expect(to('new@x.co')).toHaveLength(1);
  });
});

describe('overdue tasks', () => {
  const MORNING = new Date('2026-11-12T08:00:00Z'); // 10:00 in Cairo, the 12th
  const told = { 'mail_state/tasks': { told: {} }, 'mail_state/overdue': { since: '2026-11-09' } };
  const late = (over) => task({ date: '2026-11-10', endDate: null, ...over });

  it('tells each person once, in one mail, about their tasks whose last day has passed', async () => {
    const world = await start({ ...GUESTS, ...told });
    world.snapshot('work_tasks', [
      ['added', 'a', late({ title: 'First', assigneeUids: ['g1'], createdByUid: 'g1' })],
      ['added', 'b', late({ title: 'Second', assigneeUids: ['g1'], createdByUid: 'g1', endDate: '2026-11-11' })],
      ['added', 'c', late({ title: 'Mine', assigneeUids: ['owner'] })],
    ]);
    await settle();
    sent.length = 0;
    await world.checkOverdue(MORNING);
    expect(to('sara@x.co')).toHaveLength(1);
    expect(to('sara@x.co')[0].subject).toBe('فات موعد مهمتين');
    expect(to('sara@x.co')[0].html).toContain('متأخرة يوم واحد'); // the one ending on the 11th
    expect(to('hamed@x.co')).toHaveLength(1);
    expect(to('hamed@x.co')[0].subject).toBe('فات موعد المهمة: Mine');
    expect(to('hamed@x.co')[0].html).toContain('التأخير');
    // and not again
    sent.length = 0;
    await world.checkOverdue(new Date('2026-11-12T12:00:00Z'));
    await world.checkOverdue(new Date('2026-11-13T08:00:00Z'));
    expect(sent).toEqual([]);
  });

  it('waits for the morning', async () => {
    const world = await start({ ...GUESTS, ...told });
    world.snapshot('work_tasks', [['added', 'a', late({ assigneeUids: ['g1'], createdByUid: 'g1' })]]);
    await settle();
    await world.checkOverdue(new Date('2026-11-11T22:30:00Z')); // 00:30 in Cairo
    expect(sent).toEqual([]);
  });

  it('skips what is done, has no date, ends today or later, or was already late before this began', async () => {
    const world = await start({ ...GUESTS, ...told });
    world.snapshot('work_tasks', [
      ['added', 'done', late({ assigneeUids: ['g1'], createdByUid: 'g1', status: 'done' })],
      ['added', 'undated', late({ assigneeUids: ['g1'], createdByUid: 'g1', date: null })],
      ['added', 'today', late({ assigneeUids: ['g1'], createdByUid: 'g1', date: '2026-11-12' })],
      ['added', 'later', late({ assigneeUids: ['g1'], createdByUid: 'g1', date: '2026-11-20' })],
      ['added', 'ancient', late({ assigneeUids: ['g1'], createdByUid: 'g1', date: '2026-11-01' })],
    ]);
    await settle();
    await world.checkOverdue(MORNING);
    expect(sent).toEqual([]);
  });

  it('begins from the day it first runs: what was late before is not announced', async () => {
    const world = await start({ ...GUESTS, 'mail_state/tasks': { told: {} } });
    world.snapshot('work_tasks', [['added', 'a', late({ date: '2026-11-11', assigneeUids: ['g1'], createdByUid: 'g1' })]]);
    await settle();
    await world.checkOverdue(MORNING);
    expect(sent).toEqual([]);
    expect(world.writes.some(([col, id, data]) => col === 'mail_state' && id === 'overdue' && data.since === '2026-11-12')).toBe(true);
  });

  it('does not write to a guest who is switched off', async () => {
    const world = await start({ ...GUESTS, ...told, 'members/sara@x.co': { email: 'sara@x.co', active: false } });
    world.snapshot('work_tasks', [['added', 'a', late({ assigneeUids: ['g1'], createdByUid: 'g1' })]]);
    await settle();
    await world.checkOverdue(MORNING);
    expect(sent).toEqual([]);
  });
});

describe('a bot that has run before', () => {
  const MORNING = new Date('2026-11-12T08:00:00Z'); // 10:00 in Cairo
  const saved = { 'mail_state/tasks': { told: { t1: ['owner'] }, at: '2026-11-10T11:00:00.000Z' }, 'mail_state/overdue': { since: '2026-11-09' } };

  it('reads only the tasks changed since it last saved (two hours earlier, for clocks), not every task', async () => {
    const world = await start({ ...GUESTS, ...saved });
    expect(world.watched).toContainEqual(['work_tasks', 'updatedAt > 2026-11-10T09:00:00.000Z']);
    expect(world.watched).not.toContainEqual(['work_tasks', 'all']);
  });

  it('still mails what was given while it was off', async () => {
    const world = await start({ ...GUESTS, ...saved });
    world.snapshot('work_tasks', [['added', 'n', task({ assigneeUids: ['g1'], createdAt: '2026-11-10T11:30:00Z' })]]);
    await settle();
    expect(to('sara@x.co')).toHaveLength(1);
  });

  it('reads the open tasks once a day for the overdue check, and finds one nobody has touched', async () => {
    const quiet = { 'work_tasks/old': task({ title: 'Forgotten', status: 'todo', date: '2026-11-10', assigneeUids: ['g1'], createdByUid: 'g1' }) };
    const world = await start({ ...GUESTS, ...saved, ...quiet });
    await world.checkOverdue(MORNING);
    expect(world.lists).toEqual([['work_tasks', 'status', ['todo', 'doing']]]);
    expect(to('sara@x.co')).toHaveLength(1);
    await world.checkOverdue(new Date('2026-11-12T12:00:00Z'));
    expect(world.lists).toHaveLength(1);
  });
});
