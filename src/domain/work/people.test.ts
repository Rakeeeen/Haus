import { describe, expect, it } from 'vitest';
import { lookerKey, peopleOf } from '@/domain/work/people';

const projects: Array<{ id: string; memberProfiles: Record<string, { name: string; photoUrl: string | null }> }> = [
  { id: 'p1', memberProfiles: { owner: { name: 'Hamed', photoUrl: 'h.png' }, g1: { name: 'Sara', photoUrl: 's.png' } } },
  { id: 'p2', memberProfiles: { g2: { name: 'Omar', photoUrl: null } } },
];
const me = { key: 'owner', name: 'Hamed', photoUrl: 'me.png' };

describe('peopleOf', () => {
  it('lists the people in the order the task lists them', () => {
    expect(peopleOf({ assigneeUids: ['g1', 'owner'], projectIds: ['p1'] }, projects, me).map((p) => p.name)).toEqual(['Sara', 'Hamed']);
  });
  it('knows the looker by their own profile, even with no project', () => {
    expect(peopleOf({ assigneeUids: ['owner'], projectIds: [] }, projects, me)).toEqual([{ key: 'owner', name: 'Hamed', photoUrl: 'me.png' }]);
  });
  it('finds a person only in the projects the task is in', () => {
    expect(peopleOf({ assigneeUids: ['g2'], projectIds: ['p1'] }, projects, me)).toEqual([]);
    expect(peopleOf({ assigneeUids: ['g2'], projectIds: ['p2'] }, projects, me)).toEqual([{ key: 'g2', name: 'Omar', photoUrl: null }]);
  });
  it('leaves out someone no project names', () => {
    expect(peopleOf({ assigneeUids: ['nobody'], projectIds: ['p1'] }, projects, me)).toEqual([]);
  });
});

describe('lookerKey', () => {
  it('is the owner key for Hamed and the uid for a guest', () => {
    expect(lookerKey(true, null)).toBe('owner');
    expect(lookerKey(false, 'g1')).toBe('g1');
    expect(lookerKey(false, null)).toBe('');
  });
});
