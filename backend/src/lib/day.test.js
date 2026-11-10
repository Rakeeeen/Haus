import { describe, expect, it } from 'vitest';
import { getPomoTodayIdx, isFriday } from './day.js';

describe('the focus week', () => {
  it('counts Monday as 0 and Sunday as 6', () => {
    expect(getPomoTodayIdx(new Date('2026-11-09T10:00:00'))).toBe(0); // Monday
    expect(getPomoTodayIdx(new Date('2026-11-13T10:00:00'))).toBe(4); // Friday
    expect(getPomoTodayIdx(new Date('2026-11-15T10:00:00'))).toBe(6); // Sunday
  });
  it('knows a Friday', () => {
    expect(isFriday(new Date('2026-11-13T10:00:00'))).toBe(true);
    expect(isFriday(new Date('2026-11-12T10:00:00'))).toBe(false);
  });
});
