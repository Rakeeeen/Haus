import { describe, it, expect } from 'vitest';
import { clockLayout, clockRowsThatFit, getClockParts, MAX_CLOCK_ROWS, zoneOffsetMs } from '@/domain/clock';

describe('getClockParts', () => {
  // 2026-10-07 12:00 UTC
  const noonUtc = new Date('2026-10-07T12:00:00Z');

  it('reads the same instant in different zones', () => {
    expect(getClockParts('UTC', noonUtc)).toEqual({ hour: '12', minute: '00', period: 'PM' });
    expect(getClockParts('Asia/Dubai', noonUtc)).toEqual({ hour: '4', minute: '00', period: 'PM' });
  });

  it('uses a 12-hour clock with AM/PM and a zero-padded minute', () => {
    expect(getClockParts('UTC', new Date('2026-10-07T00:05:00Z'))).toEqual({ hour: '12', minute: '05', period: 'AM' });
  });
});

describe('clockRowsThatFit', () => {
  // A row is 90px tall, with 20px between rows: one row is 90, two 200, three 310.
  it('counts the rows that fit', () => {
    expect(clockRowsThatFit(310, 90, 20)).toBe(3);
    expect(clockRowsThatFit(309, 90, 20)).toBe(2);
    expect(clockRowsThatFit(200, 90, 20)).toBe(2);
    expect(clockRowsThatFit(199, 90, 20)).toBe(1);
  });
  it('never goes below one row or above the most', () => {
    expect(clockRowsThatFit(0, 90, 20)).toBe(1);
    expect(clockRowsThatFit(-50, 90, 20)).toBe(1);
    expect(clockRowsThatFit(5000, 90, 20)).toBe(MAX_CLOCK_ROWS);
  });
  it('shows everything when a row has no measurable height yet', () => {
    expect(clockRowsThatFit(100, 0, 20)).toBe(MAX_CLOCK_ROWS);
  });
});

describe('clockLayout', () => {
  const at = (rows: number) => clockLayout(rows).cells.map((c) => `${c.id}@${c.row},${c.col}`);

  it('is the mirrored L at full height', () => {
    expect(clockLayout(3).columns).toBe(3);
    expect(at(3)).toEqual(['london@1,3', 'dubai@2,3', 'oman@3,1', 'saudi@3,2', 'australia@3,3']);
  });
  it('moves London down into the bottom row first, keeping all five', () => {
    expect(clockLayout(2).columns).toBe(4);
    expect(at(2)).toEqual(['dubai@1,4', 'london@2,1', 'oman@2,2', 'saudi@2,3', 'australia@2,4']);
  });
  it('then Dubai, leaving one row of five', () => {
    expect(clockLayout(1).columns).toBe(5);
    expect(at(1)).toEqual(['london@1,1', 'dubai@1,2', 'oman@1,3', 'saudi@1,4', 'australia@1,5']);
  });
  it('always has the same five clocks, each once', () => {
    for (const rows of [1, 2, 3]) {
      expect(clockLayout(rows).cells.map((c) => c.id).sort()).toEqual(['australia', 'dubai', 'london', 'oman', 'saudi']);
    }
  });
  it('treats out-of-range rows as the nearest valid number', () => {
    expect(at(0)).toEqual(at(1));
    expect(at(9)).toEqual(at(3));
  });
});

describe('zoneOffsetMs', () => {
  const hour = 3_600_000;
  const winter = Date.UTC(2026, 0, 15, 12);
  const summer = Date.UTC(2026, 6, 15, 12);
  it('is zero for UTC', () => {
    expect(zoneOffsetMs('UTC', winter)).toBe(0);
  });
  it('follows daylight saving time, by the platform\'s own rules', () => {
    expect(zoneOffsetMs('Europe/London', winter)).toBe(0);
    expect(zoneOffsetMs('Europe/London', summer)).toBe(hour);
    expect(zoneOffsetMs('Africa/Cairo', winter)).toBe(2 * hour);
    expect(zoneOffsetMs('Asia/Dubai', summer)).toBe(4 * hour);
  });
});
