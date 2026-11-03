import { describe, it, expect } from 'vitest';
import { archivedDayKey, applyLateGlass } from '@/domain/water';

const times = { Fajr: '04:24', Maghrib: '18:30' };

describe('archivedDayKey', () => {
  it('is today from Maghrib until midnight', () => {
    expect(archivedDayKey(times, new Date('2026-09-10T20:00:00'))).toBe(new Date('2026-09-10T12:00:00').toDateString());
  });
  it('is yesterday after midnight, before the next Maghrib', () => {
    expect(archivedDayKey(times, new Date('2026-09-11T01:30:00'))).toBe(new Date('2026-09-10T12:00:00').toDateString());
  });
});

describe('applyLateGlass', () => {
  const key = 'Thu Sep 10 2026';

  it('adds to the archived day once the reset has run', () => {
    const next = applyLateGlass({ glasses: 0, history: { [key]: 9 } }, key, key);
    expect(next.history[key]).toBe(10);
    expect(next.glasses).toBe(0);
  });

  it('starts the day at 1 when nothing was archived (a day with no glasses)', () => {
    expect(applyLateGlass({ glasses: 0, history: {} }, key, key).history[key]).toBe(1);
  });

  it('goes on the live counter while the reset is still pending', () => {
    const next = applyLateGlass({ glasses: 9, history: {} }, 'Wed Sep 09 2026', key);
    expect(next.glasses).toBe(10);
    expect(next.history).toEqual({});
  });

  it('does not mutate its input', () => {
    const history = { [key]: 3 };
    applyLateGlass({ glasses: 0, history }, key, key);
    expect(history[key]).toBe(3);
  });
});
