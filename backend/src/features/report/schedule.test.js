import { describe, it, expect } from 'vitest';
import { afterAttempt, MAX_ATTEMPTS, reportDue } from './schedule.js';

const at = (h, m, d = 10) => new Date(2026, 10, d, h, m, 0);

describe('reportDue', () => {
  it('waits for Maghrib', () => {
    expect(reportDue({ now: at(16, 58), maghrib: '16:59', state: null })).toBe(false);
  });
  it('goes out at Maghrib, and any time later the same evening (a Mac asleep at Maghrib catches up)', () => {
    expect(reportDue({ now: at(16, 59), maghrib: '16:59', state: null })).toBe(true);
    expect(reportDue({ now: at(21, 30), maghrib: '16:59', state: null })).toBe(true);
  });
  it('goes out once a day', () => {
    expect(reportDue({ now: at(17, 5), maghrib: '16:59', state: { day: '2026-11-10', sent: true, attempts: 1 } })).toBe(false);
    expect(reportDue({ now: at(17, 5, 11), maghrib: '16:59', state: { day: '2026-11-10', sent: true, attempts: 1 } })).toBe(true);
  });
  it('retries a failure, a few times', () => {
    expect(reportDue({ now: at(17, 5), maghrib: '16:59', state: { day: '2026-11-10', sent: false, attempts: 1 } })).toBe(true);
    expect(reportDue({ now: at(17, 5), maghrib: '16:59', state: { day: '2026-11-10', sent: false, attempts: MAX_ATTEMPTS } })).toBe(false);
  });
});

describe('afterAttempt', () => {
  it('counts attempts within a day and starts again on a new day', () => {
    const first = afterAttempt(null, at(17, 0), false);
    expect(first).toEqual({ day: '2026-11-10', sent: false, attempts: 1 });
    expect(afterAttempt(first, at(17, 1), true)).toEqual({ day: '2026-11-10', sent: true, attempts: 2 });
    expect(afterAttempt(first, at(17, 1, 11), false).attempts).toBe(1);
  });
});
