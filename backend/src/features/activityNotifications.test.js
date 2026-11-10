import { describe, expect, it } from 'vitest';
import { lineCard, linesToTell } from './activityNotifications.js';

const at = (iso) => new Date(iso);
const entry = (id, iso, extra = {}) => ({ id, at: at(iso), name: 'Mona', type: 'task_status', text: 'Moved a task', ...extra });

describe('linesToTell', () => {
  const log = [entry('c', '2026-11-10T12:00:00Z'), entry('a', '2026-11-10T10:00:00Z'), entry('b', '2026-11-10T11:00:00Z')];
  it('is what happened after the last one told, oldest first', () => {
    expect(linesToTell(log, '2026-11-10T10:00:00Z').map((e) => e.id)).toEqual(['b', 'c']);
  });
  it('is nothing when everything has been told', () => {
    expect(linesToTell(log, '2026-11-10T12:00:00Z')).toEqual([]);
  });
  it('skips a line whose time the server has not filled in yet', () => {
    expect(linesToTell([{ id: 'x', at: null }], '2026-11-10T10:00:00Z')).toEqual([]);
  });
});

describe('lineCard', () => {
  it('names the person and says what they did', () => {
    const embed = lineCard(entry('a', '2026-11-10T10:00:00Z', { type: 'entered', text: 'Opened Haus' })).toJSON();
    expect(embed.description).toContain('Mona');
    expect(embed.description).toContain('Opened Haus');
  });
});
