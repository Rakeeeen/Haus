import { describe, expect, it } from 'vitest';
import { byDay, entriesOf, statusChangeText, type ActivityEntry } from '@/domain/activity';

const entry = (id: string, uid: string, at: string): ActivityEntry => ({ id, uid, name: uid, type: 'entered', text: '', at });

describe('statusChangeText', () => {
  it('names the task and both statuses', () => {
    expect(statusChangeText('Finish unit 1', 'todo', 'doing')).toBe('Moved “Finish unit 1” from To do to Doing');
  });
  it('shortens a very long title and names an empty one', () => {
    expect(statusChangeText('x'.repeat(200), 'todo', 'done').length).toBeLessThan(120);
    expect(statusChangeText('  ', 'todo', 'done')).toContain('Untitled');
  });
});

describe('entriesOf', () => {
  const list = [entry('1', 'a', '2026-11-10T09:00:00Z'), entry('2', 'b', '2026-11-10T10:00:00Z'), entry('3', 'a', '2026-11-10T11:00:00Z')];
  it('is everyone, newest first, or one person', () => {
    expect(entriesOf(list, null).map((e) => e.id)).toEqual(['3', '2', '1']);
    expect(entriesOf(list, 'a').map((e) => e.id)).toEqual(['3', '1']);
  });
});

describe('byDay', () => {
  it('groups consecutive entries under the day they happened', () => {
    const noon = (d: number) => new Date(2026, 10, d, 12).toISOString();
    const groups = byDay([entry('1', 'a', noon(10)), entry('2', 'a', noon(10)), entry('3', 'a', noon(9))]);
    expect(groups.map((g) => [g.day, g.entries.length])).toEqual([['2026-11-10', 2], ['2026-11-09', 1]]);
  });
});
