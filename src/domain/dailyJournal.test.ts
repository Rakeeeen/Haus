import { describe, expect, it } from 'vitest';
import { hasActivity, historyKey, journalEntryFor, localDayKey, weekPatternOf, type DaySnapshot } from '@/domain/dailyJournal';

const day = (water: number, focus: number): DaySnapshot => ({ water, focus, workout: 0 });
const now = new Date('2026-11-09T12:00:00Z');
const keyAgo = (n: number) => { const d = new Date(now); d.setDate(d.getDate() - n); return historyKey(d); };
const history = (days: Array<DaySnapshot | null>) => Object.fromEntries(days.flatMap((d, i) => (d ? [[keyAgo(i), d]] : [])));

describe('weekPatternOf', () => {
  it('says nothing with fewer than three days recorded', () => {
    expect(weekPatternOf(history([day(10, 60), day(10, 60)]), now)).toBe('neutral');
  });
  it('is momentum when each of the last three days did both', () => {
    expect(weekPatternOf(history([day(9, 40), day(9, 40), day(9, 40)]), now)).toBe('momentum');
  });
  it('is a slump when the last three days did neither', () => {
    expect(weekPatternOf(history([day(0, 0), day(2, 5), day(1, 0)]), now)).toBe('slump');
  });
  it('is rising or fading against the four days before', () => {
    expect(weekPatternOf(history([day(9, 40), day(9, 40), day(9, 0), day(0, 0), day(0, 0), day(0, 0), day(0, 0)]), now)).toBe('rising');
    expect(weekPatternOf(history([day(0, 0), day(0, 0), day(9, 0), day(9, 40), day(9, 40), day(9, 40), day(9, 40)]), now)).toBe('fading');
  });
});

describe('journalEntryFor', () => {
  it('writes the date, the water and the focus', () => {
    expect(journalEntryFor('2026-11-09', day(7, 45))).toBe('November 9 — water was decent, focus ran 45m.');
    expect(journalEntryFor('2026-11-09', day(11, 125))).toBe('November 9 — water was strong, focus ran 2h.');
    expect(journalEntryFor('2026-11-09', day(0, 0))).toBe('November 9 — no water logged, no focus.');
  });
});

describe('keys and activity', () => {
  it('writes a local day key', () => {
    expect(localDayKey(new Date(2026, 10, 9, 23, 30))).toBe('2026-11-09');
  });
  it('knows a day with nothing in it', () => {
    expect(hasActivity(day(0, 0))).toBe(false);
    expect(hasActivity(day(1, 0))).toBe(true);
  });
});
