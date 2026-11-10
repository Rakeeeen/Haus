import { describe, expect, it } from 'vitest';
import { DRAFT_TTL_MS, isFresh } from './draftMemory';

describe('isFresh', () => {
  it('keeps a draft for ten minutes', () => {
    expect(isFresh(1_000, 1_000 + DRAFT_TTL_MS)).toBe(true);
    expect(isFresh(1_000, 1_000 + DRAFT_TTL_MS + 1)).toBe(false);
  });
  it('is not fooled by a time in the future or a broken value', () => {
    expect(isFresh(5_000, 1_000)).toBe(false);
    expect(isFresh(Number.NaN, 1_000)).toBe(false);
  });
});
