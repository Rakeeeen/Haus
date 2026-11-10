import { describe, it, expect } from 'vitest';
import {
  breakMinutesFor, breakTimer, closeOutFocusDay, idleTimer, minutesSoFar, minutesWithOvertime, newSessionTimer, recordSession, weekOrSeed,
} from '@/domain/focus/session';

describe('breakMinutesFor — 20% of focus, min 1', () => {
  it('25 minutes → 5', () => expect(breakMinutesFor(25)).toBe(5));
  it('50 minutes → 10', () => expect(breakMinutesFor(50)).toBe(10));
  it('rounds: 35 → 7', () => expect(breakMinutesFor(35)).toBe(7));
  it('never below a minute', () => {
    expect(breakMinutesFor(3)).toBe(1);
    expect(breakMinutesFor(0)).toBe(1);
  });
});

describe('recordSession', () => {
  const week = [{ day: 'Mon', sessions: 1, minutes: 25 }, { day: 'Tue', sessions: 0 }];

  it('adds a session and its minutes to just that day', () => {
    const next = recordSession(week, 1, 40);
    expect(next[1]).toEqual({ day: 'Tue', sessions: 1, minutes: 40 });
    expect(next[0]).toBe(week[0]);
  });

  it('stacks on what the day already has, and never mutates the week', () => {
    expect(recordSession(week, 0, 10)[0]).toMatchObject({ sessions: 2, minutes: 35 });
    expect(week[0]).toEqual({ day: 'Mon', sessions: 1, minutes: 25 });
  });
});

describe('weekOrSeed', () => {
  const seed = [{ day: 'Mon', sessions: 0 }];
  const week = Array.from({ length: 7 }, (_, i) => ({ day: String(i), sessions: 1 }));
  it('keeps a full week', () => expect(weekOrSeed(week, seed)).toBe(week));
  it('falls back to the seed for anything else', () => {
    expect(weekOrSeed(week.slice(0, 3), seed)).toBe(seed);
    expect(weekOrSeed(null, seed)).toBe(seed);
    expect(weekOrSeed('x', seed)).toBe(seed);
  });
});

describe('timer states', () => {
  it('idle is a full focus session, stopped', () => {
    expect(idleTimer(25)).toEqual({ timeLeft: 1500, overtime: 0, isOvertime: false, running: false, mode: 'focus' });
  });
  it('a new session is the same, running', () => {
    expect(newSessionTimer(25)).toEqual({ ...idleTimer(25), running: true });
  });
  it('a break is its own length, running', () => {
    expect(breakTimer(5)).toEqual({ timeLeft: 300, overtime: 0, isOvertime: false, running: true, mode: 'break' });
  });
});

describe('minutes of a session', () => {
  it('with overtime: the whole session plus the whole minutes it ran over', () => {
    expect(minutesWithOvertime(25, 0)).toBe(25);
    expect(minutesWithOvertime(25, 125)).toBe(27);
  });
  it('so far: what has elapsed (plus overtime), at least a minute', () => {
    expect(minutesSoFar(25, 600, 0)).toBe(15);
    expect(minutesSoFar(25, 0, 180)).toBe(28);
    expect(minutesSoFar(25, 1490, 0)).toBe(1);
  });
});

describe('closeOutFocusDay', () => {
  const seed = Array.from({ length: 7 }, (_, i) => ({ day: String(i), sessions: 0 }));
  const week = seed.map((d, i) => (i === 2 ? { ...d, sessions: 3, minutes: 75 } : { ...d, sessions: 1, minutes: 20 }));
  it('archives the day if anything was done, and zeroes just its slot', () => {
    const { archived, nextWeek } = closeOutFocusDay(week, 2, seed);
    expect(archived).toEqual({ sessions: 3, minutes: 75 });
    expect(nextWeek[2]).toEqual({ sessions: 0, minutes: 0 });
    expect(nextWeek[1]).toBe(week[1]);
  });
  it('archives nothing for a day with no sessions', () => {
    expect(closeOutFocusDay(seed, 2, seed).archived).toBeNull();
  });
  it('starts the week over after Friday', () => {
    expect(closeOutFocusDay(week, 4, seed).nextWeek).toBe(seed);
  });
});
