// @vitest-environment jsdom
import React, { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PomodoroProvider, usePomodoro } from '@/data/usePomodoro';

// Firestore's synced values, replaced by a plain in-memory store: each key is a value any hook can read and write.
const store = new Map<string, unknown>();
vi.mock('@/data/useFirebaseSync', () => ({
  useFirebaseSync: <T,>(key: string, initial: T) => {
    const [value, setValue] = useState<T>(() => (store.has(key) ? (store.get(key) as T) : initial));
    const set = (next: T | ((v: T) => T)) => {
      setValue((prev) => {
        const resolved = next instanceof Function ? next(prev) : next;
        store.set(key, resolved);
        return resolved;
      });
    };
    return [value, set, true] as const;
  },
}));
vi.mock('@/data/usePrayer', () => ({ usePrayer: () => ({ times: undefined }) }));

const wrapper = ({ children }: { children: React.ReactNode }) => <PomodoroProvider>{children}</PomodoroProvider>;
const setup = () => renderHook(() => usePomodoro(), { wrapper });
// Time passes in one-second steps, each followed by a render — as in a browser. One long jump would run every timer
// callback before React could re-render, so the timer's effects (which restart on each state change) would never get a turn.
const tick = (seconds: number) => { for (let i = 0; i < seconds; i++) act(() => { vi.advanceTimersByTime(1000); }); };
const sent = () => store.get('focus_notification') as { type: string; focusMinutes: number; overtimeSeconds: number } | null;

beforeEach(() => {
  store.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-09T10:00:00')); // a Monday morning, long before Isha
});
afterEach(() => vi.useRealTimers());

describe('the focus timer', () => {
  it('starts idle: a full 25 minutes, focus mode, not running', () => {
    const { result } = setup();
    expect(result.current).toMatchObject({ timeLeft: 1500, running: false, mode: 'focus', isOvertime: false, overtime: 0, sessions: 0 });
  });

  it('counts down in real time once started, and keeps a checkpoint', () => {
    const { result } = setup();
    act(() => result.current.start());
    tick(10);
    expect(result.current.running).toBe(true);
    expect(result.current.timeLeft).toBe(1490);
    expect((store.get('pomodoro_checkpoint') as { running: boolean }).running).toBe(true);
  });

  it('pauses where it is', () => {
    const { result } = setup();
    act(() => result.current.start());
    tick(30);
    act(() => result.current.pause());
    tick(30);
    expect(result.current.running).toBe(false);
    expect(result.current.timeLeft).toBe(1470);
  });

  it('runs into overtime at zero, and tells Discord the time is up', () => {
    const { result } = setup();
    act(() => result.current.start());
    tick(1500);
    expect(result.current.isOvertime).toBe(true);
    expect(sent()).toMatchObject({ type: 'focus_timer_up', focusMinutes: 25 });
    tick(45);
    expect(result.current.overtime).toBe(45);
  });

  it('a break after overtime logs the whole session and starts a break of a fifth of it', () => {
    const { result } = setup();
    act(() => result.current.start());
    tick(1500 + 125);
    act(() => result.current.startBreak());
    expect(result.current.sessions).toBe(1);
    expect(result.current.logs[0].duration).toBe(27);
    expect(result.current.weekStats[0]).toMatchObject({ day: 'Mon', sessions: 1, minutes: 27 });
    expect(result.current).toMatchObject({ mode: 'break', running: true, isOvertime: false, overtime: 0, breakDuration: 5, timeLeft: 300 });
    expect(sent()).toMatchObject({ type: 'focus_complete', overtimeSeconds: 125 });
  });

  it('"Done" early saves what has been focused so far and starts a break', () => {
    const { result } = setup();
    act(() => result.current.start());
    tick(600);
    act(() => result.current.saveProgress());
    expect(result.current.logs[0].duration).toBe(10);
    expect(result.current.weekStats[0].minutes).toBe(10);
    expect(result.current).toMatchObject({ mode: 'break', running: true, breakDuration: 2, timeLeft: 120 });
  });

  it('saving does nothing during a break', () => {
    const { result } = setup();
    act(() => result.current.start());
    tick(600);
    act(() => result.current.saveProgress());
    act(() => result.current.saveProgress());
    expect(result.current.sessions).toBe(1);
  });

  it('a finished break goes back to a fresh idle session and clears the checkpoint', () => {
    const { result } = setup();
    act(() => result.current.start());
    tick(600);
    act(() => result.current.saveProgress());
    tick(121);
    expect(result.current).toMatchObject({ mode: 'focus', running: false, timeLeft: 1500 });
    expect(store.get('pomodoro_checkpoint')).toBeNull();
    expect(sent()).toMatchObject({ type: 'break_complete' });
  });

  it('reset and skip-break both go back to idle', () => {
    const { result } = setup();
    act(() => result.current.start());
    tick(100);
    act(() => result.current.reset());
    expect(result.current).toMatchObject({ mode: 'focus', running: false, timeLeft: 1500 });
    act(() => result.current.start());
    tick(600);
    act(() => result.current.saveProgress());
    act(() => result.current.skipBreak());
    expect(result.current).toMatchObject({ mode: 'focus', running: false, timeLeft: 1500, isOvertime: false });
    expect(store.get('pomodoro_checkpoint')).toBeNull();
  });

  it('starts a new session straight from the end of a break', () => {
    const { result } = setup();
    act(() => result.current.startNewSession());
    expect(result.current).toMatchObject({ mode: 'focus', running: true, timeLeft: 1500 });
  });
});

describe('a timer changed elsewhere', () => {
  it('is adopted: another device (or the bot) starting a session starts it here', () => {
    store.set('pomodoro_checkpoint', { timeLeft: 900, overtime: 0, isOvertime: false, running: true, mode: 'focus', writtenBy: 'the-bot' });
    const { result } = setup();
    expect(result.current).toMatchObject({ timeLeft: 900, running: true, mode: 'focus' });
  });

  it('a stored idle (null) checkpoint is idle, not "nothing yet"', () => {
    store.set('pomodoro_checkpoint', null);
    const { result } = setup();
    expect(result.current).toMatchObject({ timeLeft: 1500, running: false });
  });

  it('is not re-applied when it is only this tab\'s own write coming back', () => {
    const { result } = setup();
    act(() => result.current.start());
    tick(5);
    const own = store.get('pomodoro_checkpoint') as { writtenBy: string };
    expect(own.writtenBy).toBeTruthy();
    // The same write echoing back must not rewind the timer to the older value it holds.
    const before = result.current.timeLeft;
    tick(2);
    expect(result.current.timeLeft).toBeLessThan(before);
  });
});

describe('a session left running through Isha', () => {
  it('is saved by itself, then the timer goes idle (no break: focus is locked until Fajr)', () => {
    vi.setSystemTime(new Date('2026-11-09T18:50:00')); // fallback Isha is 19:00
    const { result } = setup();
    act(() => result.current.start());
    tick(11 * 60);
    expect(result.current.sessions).toBe(1);
    expect(result.current.logs[0].duration).toBeGreaterThanOrEqual(10);
    expect(result.current).toMatchObject({ mode: 'focus', running: false, timeLeft: 1500 });
    expect(sent()).toMatchObject({ type: 'focus_complete' });
  });
});
