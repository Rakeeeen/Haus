import { describe, it, expect } from 'vitest';
import { byMostOpened, byRecentUse, isProjectUse, noteUse } from '@/domain/work/recentProjects';

const projects = [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }, { id: 'c', name: 'Gamma' }];

describe('noteUse', () => {
  it('counts each use and remembers the latest', () => {
    const use = noteUse(noteUse({}, 'a', 100), 'a', 200);
    expect(use).toEqual({ a: { last: 200, count: 2 } });
  });
});

describe('byRecentUse', () => {
  it('puts the project chosen last first, then the earlier ones, then the never-used by name', () => {
    const use = noteUse(noteUse({}, 'c', 100), 'b', 200);
    expect(byRecentUse(projects, use).map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });
  it('is alphabetical when nothing was ever chosen', () => {
    expect(byRecentUse([...projects].reverse(), {}).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('byMostOpened', () => {
  it('puts the most opened first, the more recent one on a tie', () => {
    let use = noteUse({}, 'a', 100);
    use = noteUse(use, 'c', 200);
    use = noteUse(use, 'c', 300);
    use = noteUse(use, 'b', 400);
    expect(byMostOpened(projects, use).map((p) => p.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('isProjectUse', () => {
  it('accepts what noteUse makes and rejects the rest', () => {
    expect(isProjectUse({ a: { last: 1, count: 2 } })).toBe(true);
    expect(isProjectUse({ a: { last: 'x', count: 2 } })).toBe(false);
    expect(isProjectUse([])).toBe(false);
    expect(isProjectUse(null)).toBe(false);
  });
});
