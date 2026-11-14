import { describe, expect, it } from 'vitest';
import { closedWaterDayKey, focusCloseOut, isFocusNightLockedFor, isWaterClosedFor } from '@/domain/dayRules';

const times = { Fajr: '04:00', Sunrise: '05:30', Dhuhr: '12:00', Asr: '15:00', Maghrib: '18:30', Isha: '19:45' };
const at = (hhmm: string, day = '2026-11-09') => new Date(`${day}T${hhmm}:00`); // 2026-11-09 is a Monday
const key = (day: string) => new Date(`${day}T12:00:00`).toDateString();

describe('isWaterClosedFor', () => {
  it('keeps Hamed on Maghrib → Fajr', () => {
    expect(isWaterClosedFor('owner', times, at('18:30'))).toBe(true);
    expect(isWaterClosedFor('owner', times, at('12:00'))).toBe(false);
  });
  it('closes a guest at midnight and reopens at Fajr, not at Maghrib', () => {
    expect(isWaterClosedFor('guest', times, at('00:00'))).toBe(true);
    expect(isWaterClosedFor('guest', times, at('03:59'))).toBe(true);
    expect(isWaterClosedFor('guest', times, at('04:00'))).toBe(false);
    expect(isWaterClosedFor('guest', times, at('18:30'))).toBe(false);
    expect(isWaterClosedFor('guest', times, at('23:59'))).toBe(false);
  });
});

describe('isFocusNightLockedFor', () => {
  it('keeps Hamed on Isha → Fajr', () => {
    expect(isFocusNightLockedFor('owner', times, at('19:45'))).toBe(true);
    expect(isFocusNightLockedFor('owner', times, at('19:00'))).toBe(false);
  });
  it('locks a guest from midnight to Fajr only', () => {
    expect(isFocusNightLockedFor('guest', times, at('00:30'))).toBe(true);
    expect(isFocusNightLockedFor('guest', times, at('04:30'))).toBe(false);
    expect(isFocusNightLockedFor('guest', times, at('21:00'))).toBe(false);
  });
});

describe('closedWaterDayKey', () => {
  it('is Hamed\'s Maghrib rule: today after Maghrib, yesterday before it', () => {
    expect(closedWaterDayKey('owner', times, at('20:00'))).toBe(key('2026-11-09'));
    expect(closedWaterDayKey('owner', times, at('10:00'))).toBe(key('2026-11-08'));
  });
  it('is always yesterday for a guest, whatever the hour', () => {
    expect(closedWaterDayKey('guest', times, at('00:05'))).toBe(key('2026-11-08'));
    expect(closedWaterDayKey('guest', times, at('23:50'))).toBe(key('2026-11-08'));
  });
});

describe('focusCloseOut', () => {
  it('is due for Hamed only from Isha, and closes today', () => {
    expect(focusCloseOut('owner', times, at('19:00')).due).toBe(false);
    expect(focusCloseOut('owner', times, at('19:45'))).toEqual({ due: true, key: key('2026-11-09'), dayIndex: 0 });
  });
  it('is due for a guest all day once the day has turned, and closes yesterday', () => {
    expect(focusCloseOut('guest', times, at('00:01'))).toEqual({ due: true, key: key('2026-11-08'), dayIndex: 6 }); // Sunday's slot
    expect(focusCloseOut('guest', times, at('15:00'))).toEqual({ due: true, key: key('2026-11-08'), dayIndex: 6 });
  });
  it('closes the right slot across a month boundary', () => {
    expect(focusCloseOut('guest', times, at('00:10', '2026-12-01'))).toMatchObject({ key: key('2026-11-30'), dayIndex: 0 });
  });
});
