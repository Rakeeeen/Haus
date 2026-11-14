// @vitest-environment jsdom
import { useState } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyResetManager } from '@/app/DailyResetManager';
import { POMODORO_WEEKLY_MOCK } from '@/constants/mockData';

// Synced values as a plain in-memory store that also mirrors localStorage, as the real hook does.
const store = new Map<string, unknown>();
vi.mock('@/data/useFirebaseSync', () => ({
  useFirebaseSync: <T,>(key: string, initial: T) => {
    const [value, setValue] = useState<T>(() => (store.has(key) ? (store.get(key) as T) : initial));
    const set = (next: T | ((v: T) => T)) => {
      setValue((prev) => {
        const resolved = next instanceof Function ? next(prev) : next;
        store.set(key, resolved);
        window.localStorage.setItem(key, JSON.stringify(resolved));
        return resolved;
      });
    };
    return [value, set, true] as const;
  },
}));
vi.mock('@/data/usePrayer', () => ({ usePrayer: () => ({ times: undefined }) })); // fallbacks: Maghrib 18:00, Isha 19:00

const seed = (key: string, value: unknown) => { store.set(key, value); window.localStorage.setItem(key, JSON.stringify(value)); };
const week = (sessions: number[]) => sessions.map((s, i) => ({ day: POMODORO_WEEKLY_MOCK[i].day, sessions: s, minutes: s * 25 }));
const run = (role?: 'owner' | 'guest') => { render(<DailyResetManager role={role} />); };

beforeEach(() => {
  store.clear();
  window.localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('the Maghrib water close-out', () => {
  it('archives the day\'s glasses under that day and zeroes the counter', () => {
    vi.setSystemTime(new Date('2026-11-09T18:30:00')); // Monday, after Maghrib
    seed('hydration_glasses', 7);
    run();
    expect(store.get('hydration_history')).toEqual({ [new Date('2026-11-09T12:00:00').toDateString()]: 7 });
    expect(store.get('hydration_glasses')).toBe(0);
    expect(store.get('system_last_reset_date')).toBe(new Date('2026-11-09T12:00:00').toDateString());
  });

  it('archives nothing when no glass was drunk', () => {
    vi.setSystemTime(new Date('2026-11-09T18:30:00'));
    seed('hydration_glasses', 0);
    run();
    expect(store.get('hydration_history')).toBeUndefined();
  });

  it('runs once a day, not again on later checks', () => {
    vi.setSystemTime(new Date('2026-11-09T18:30:00'));
    seed('hydration_glasses', 7);
    run();
    seed('hydration_glasses', 3); // drunk after the reset (a "late glass" is handled elsewhere)
    act(() => { vi.advanceTimersByTime(10 * 60 * 1000); });
    expect(store.get('hydration_glasses')).toBe(3);
  });

  it('before Maghrib the day still belongs to yesterday', () => {
    vi.setSystemTime(new Date('2026-11-09T10:00:00'));
    seed('hydration_glasses', 4);
    seed('system_last_reset_date', new Date('2026-11-08T12:00:00').toDateString()); // yesterday's was already done
    run();
    expect(store.get('hydration_glasses')).toBe(4);
  });
});

describe('the Isha focus close-out', () => {
  it('archives today\'s sessions and zeroes just today\'s slot', () => {
    vi.setSystemTime(new Date('2026-11-09T19:30:00')); // Monday = slot 0
    seed('pomodoro_week', week([2, 1, 1, 1, 1, 0, 0]));
    seed('pomodoro_sessions', 2);
    run();
    expect(store.get('pomodoro_history')).toEqual({ [new Date('2026-11-09T12:00:00').toDateString()]: { sessions: 2, minutes: 50 } });
    expect(store.get('pomodoro_sessions')).toBe(0);
    const next = store.get('pomodoro_week') as Array<{ sessions: number }>;
    expect(next[0].sessions).toBe(0);
    expect(next[1].sessions).toBe(1);
  });

  it('does nothing before Isha', () => {
    vi.setSystemTime(new Date('2026-11-09T18:45:00'));
    seed('pomodoro_week', week([2, 0, 0, 0, 0, 0, 0]));
    run();
    expect(store.get('pomodoro_history')).toBeUndefined();
  });

  it('starts the week over after Friday\'s Isha', () => {
    vi.setSystemTime(new Date('2026-11-13T19:30:00')); // Friday = slot 4
    seed('pomodoro_week', week([1, 1, 1, 1, 3, 0, 0]));
    run();
    expect(store.get('pomodoro_week')).toEqual(POMODORO_WEEKLY_MOCK);
    expect((store.get('pomodoro_history') as Record<string, { sessions: number }>)[new Date('2026-11-13T12:00:00').toDateString()].sessions).toBe(3);
  });

  it('closes a day only once', () => {
    vi.setSystemTime(new Date('2026-11-09T19:30:00'));
    seed('pomodoro_week', week([2, 0, 0, 0, 0, 0, 0]));
    run();
    seed('pomodoro_week', week([4, 0, 0, 0, 0, 0, 0]));
    act(() => { vi.advanceTimersByTime(10 * 60 * 1000); });
    expect((store.get('pomodoro_week') as Array<{ sessions: number }>)[0].sessions).toBe(4);
  });
});

describe('a guest\'s day closes at midnight', () => {
  const yesterday = new Date('2026-11-08T12:00:00').toDateString();

  it('archives yesterday\'s glasses and zeroes the counter just after midnight, not at Maghrib', () => {
    vi.setSystemTime(new Date('2026-11-09T00:30:00'));
    seed('system_guest_water_closed', new Date('2026-11-07T12:00:00').toDateString());
    seed('hydration_glasses', 6);
    run('guest');
    expect(store.get('hydration_history')).toEqual({ [yesterday]: 6 });
    expect(store.get('hydration_glasses')).toBe(0);
    expect(store.get('system_guest_water_closed')).toBe(yesterday);
  });

  it('does not touch the water at Maghrib', () => {
    vi.setSystemTime(new Date('2026-11-09T18:30:00'));
    seed('system_guest_water_closed', yesterday); // the midnight close-out already ran today
    seed('hydration_glasses', 5);
    run('guest');
    expect(store.get('hydration_glasses')).toBe(5);
  });

  it('closes yesterday\'s focus slot after midnight, not at Isha', () => {
    vi.setSystemTime(new Date('2026-11-09T00:30:00')); // Monday: the day that closed is Sunday = slot 6
    seed('system_guest_focus_closed', new Date('2026-11-07T12:00:00').toDateString());
    seed('pomodoro_week', week([0, 0, 0, 0, 0, 0, 3]));
    seed('pomodoro_sessions', 3);
    run('guest');
    expect(store.get('pomodoro_history')).toEqual({ [yesterday]: { sessions: 3, minutes: 75 } });
    expect(store.get('pomodoro_sessions')).toBe(0);
  });
});

describe('a guest\'s first close-out only notes the day', () => {
  it('leaves the water and focus alone, whatever the hour', () => {
    vi.setSystemTime(new Date('2026-11-09T14:00:00'));
    seed('hydration_glasses', 4);
    seed('pomodoro_week', week([0, 0, 0, 0, 0, 0, 0]));
    seed('pomodoro_sessions', 9);
    run('guest');
    expect(store.get('hydration_glasses')).toBe(4);
    expect(store.get('pomodoro_sessions')).toBe(9);
    expect(store.get('pomodoro_history')).toBeUndefined();
    expect(store.get('system_guest_water_closed')).toBe(new Date('2026-11-08T12:00:00').toDateString());
    expect(store.get('system_guest_focus_closed')).toBe(new Date('2026-11-08T12:00:00').toDateString());
  });

  it('ignores the old Maghrib/Isha markers', () => {
    vi.setSystemTime(new Date('2026-11-09T14:00:00'));
    seed('system_last_pomo_reset_date', new Date('2026-11-06T12:00:00').toDateString());
    seed('pomodoro_sessions', 9);
    run('guest');
    expect(store.get('pomodoro_sessions')).toBe(9);
  });
});
