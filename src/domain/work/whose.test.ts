import { describe, expect, it } from 'vitest';
import { forMeOf, validWhose, whoseOptions } from '@/domain/work/whose';

describe('forMeOf', () => {
  it('is the viewer for "mine", nobody for "all", and the person picked otherwise', () => {
    expect(forMeOf('mine', 'owner')).toBe('owner');
    expect(forMeOf('all', 'owner')).toBeUndefined();
    expect(forMeOf('guest-1', 'owner')).toBe('guest-1');
  });
});

describe('whoseOptions', () => {
  it('lists Mine, Everyone and each other person once', () => {
    const options = whoseOptions([{ key: 'owner', name: 'Hamed' }, { key: 'g1', name: 'Mona' }], 'owner');
    expect(options.map((o) => o.label)).toEqual(['Mine', 'Everyone', 'Mona']);
  });
});

describe('validWhose', () => {
  it('keeps a choice that is on offer and drops one that is not', () => {
    const options = [{ value: 'mine' }, { value: 'all' }, { value: 'g1' }];
    expect(validWhose('g1', options)).toBe('g1');
    expect(validWhose('gone', options)).toBe('mine');
  });
});
