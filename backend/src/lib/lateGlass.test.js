import { describe, it, expect } from 'vitest';
import { archivedDayKey, applyLateGlass } from './lateGlass.js';

const key = new Date('2026-09-10T12:00:00').toDateString();

describe('archivedDayKey', () => {
  it('is today from Maghrib until midnight', () => {
    expect(archivedDayKey('18:30', new Date('2026-09-10T20:00:00'))).toBe(key);
  });
  it('is yesterday after midnight', () => {
    expect(archivedDayKey('18:30', new Date('2026-09-11T01:30:00'))).toBe(key);
  });
});

describe('applyLateGlass', () => {
  it('adds to the archived day once the reset has run', () => {
    expect(applyLateGlass({ glasses: 0, history: { [key]: 9 } }, key, key)).toEqual({ glasses: 0, history: { [key]: 10 } });
  });
  it('goes on the live counter while the reset is pending', () => {
    expect(applyLateGlass({ glasses: 9, history: {} }, 'Wed Sep 09 2026', key)).toEqual({ glasses: 10, history: {} });
  });
});
