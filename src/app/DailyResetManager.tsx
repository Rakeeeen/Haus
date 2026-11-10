import React, { useEffect, useRef } from 'react';
import { useFirebaseSync } from '@/data/useFirebaseSync';
import { usePrayer } from '@/data/usePrayer';
import { readStored, writeStored } from '@/data/dataScope';
import { POMODORO_WEEKLY_MOCK } from '@/constants/mockData';
import { getDayMoments } from '@/domain/devotion/prayer';
import { closeOutFocusDay, weekOrSeed, type FocusDayStats, type FocusWeekDay } from '@/domain/focus/session';
import { archivedDayKey } from '@/domain/water';

/** How often it checks whether a close-out is due. */
const CHECK_EVERY_MS = 2 * 60 * 1000;

/**
 * Rolls the day over: archives water into history and zeroes today's count at the
 * real Maghrib time, and archives/zeroes focus sessions at the real Isha time.
 * Both are single close-out actions now — Water is locked Maghrib→Fajr and Focus is
 * locked Isha→Fajr (see Water.tsx / Pomodoro.tsx), so nothing can accumulate after
 * either lock kicks in and there's no separate "merge the leftover" step needed.
 *
 * Not calendar-related — it used to also cache "next sleep time" from a Google
 * Calendar feed for a since-removed Calendar page; that fetch is gone.
 */
export const DailyResetManager: React.FC = () => {
  // Guards against double-firing when Firebase hasn't confirmed lastResetDate yet
  const firedResetMarkerRef = useRef<string>('');
  const firedPomoIshaMarkerRef = useRef<string>('');

  // Real Maghrib/Isha adhan times, refreshed daily from the prayer API — close out
  // "today" for the water and focus/pomodoro resets at these exact moments.
  const { times: prayerTimes } = usePrayer();

  // Setters for resetting. Values are read fresh from localStorage inside the reset
  // functions (or via functional setState), so the raw values are intentionally not
  // destructured here — that keeps this component from re-running its effect on every
  // water sip / focus tick.
  const [, setGlasses, glassesReady] = useFirebaseSync<number>('hydration_glasses', 0);
  const [, setHistory, historyReady] = useFirebaseSync<Record<string, number>>('hydration_history', {});

  const [, setPomoSessions, pomoReady] = useFirebaseSync<number>('pomodoro_sessions', 0);
  const [, setPomoWeek, pomoWeekReady] = useFirebaseSync<FocusWeekDay[]>('pomodoro_week', POMODORO_WEEKLY_MOCK);
  const [, setPomoHistory, pomoHistoryReady] = useFirebaseSync<Record<string, FocusDayStats>>('pomodoro_history', {});

  const [lastResetDate, setLastResetDate, lastResetDateReady] = useFirebaseSync<string>('system_last_reset_date', '');
  const [lastPomoIshaResetDate, setLastPomoIshaResetDate, lastPomoIshaResetDateReady] = useFirebaseSync<string>('system_last_pomo_reset_date', '');

  useEffect(() => {
    // Wait until ALL the synced values are ready before deciding whether to reset.
    if (!glassesReady || !historyReady || !pomoReady || !pomoWeekReady || !pomoHistoryReady || !lastResetDateReady || !lastPomoIshaResetDateReady) return;

    // Water: at Maghrib the day's glasses are archived under that day and the counter is zeroed.
    const checkWaterReset = () => {
      const marker = archivedDayKey(prayerTimes, new Date());
      if (lastResetDate === marker || firedResetMarkerRef.current === marker) return;
      firedResetMarkerRef.current = marker;
      // The marker is written to storage at once (value + updatedAt, like useFirebaseSync's setValue), so a refresh in the
      // middle of the reset sees it, and Firestore's listener can't clobber it with the stale server value once it connects.
      writeStored('system_last_reset_date', marker);
      // Read from localStorage, not React state: state can lag behind what Water.tsx just wrote (a Firestore listener's update
      // isn't guaranteed to have flushed), which would archive the tally as 0.
      const glasses = Number(readStored<number>('hydration_glasses', 0)) || 0;
      if (glasses > 0) setHistory((prev) => ({ ...(prev || {}), [marker]: glasses }));
      setGlasses(0);
      setLastResetDate(marker);
    };

    // Focus: Isha is the day's single close-out — today's progress goes into history and the counter is zeroed. Focus is
    // locked Isha→Fajr (Pomodoro.tsx), so nothing can accumulate afterwards and there is no "merge the leftover" step.
    // Without loaded prayer times it uses the same fallbacks as the lock itself.
    const checkFocusReset = () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toDateString();
      if (now.getTime() < getDayMoments(prayerTimes, now).isha) return;
      if (lastPomoIshaResetDate === today || firedPomoIshaMarkerRef.current === today) return;
      firedPomoIshaMarkerRef.current = today;
      writeStored('system_last_pomo_reset_date', today);

      const dayIndex = (now.getDay() + 6) % 7; // Mon = 0 … Sun = 6
      const { archived, nextWeek } = closeOutFocusDay(weekOrSeed(readStored<FocusWeekDay[] | null>('pomodoro_week', null), POMODORO_WEEKLY_MOCK), dayIndex, POMODORO_WEEKLY_MOCK);
      if (archived) setPomoHistory((prev) => ({ ...(prev || {}), [today]: archived }));
      setPomoSessions(0);
      setPomoWeek(nextWeek);
      setLastPomoIshaResetDate(today);
    };

    const runChecks = () => {
      checkWaterReset();
      checkFocusReset();
    };

    const interval = setInterval(runChecks, CHECK_EVERY_MS);
    runChecks();
    return () => clearInterval(interval);
  }, [
    lastResetDate, lastPomoIshaResetDate,
    setGlasses, setHistory, setLastResetDate, setLastPomoIshaResetDate, setPomoSessions, setPomoWeek, setPomoHistory,
    glassesReady, historyReady, pomoReady, pomoWeekReady, pomoHistoryReady, lastResetDateReady, lastPomoIshaResetDateReady,
    prayerTimes
  ]);

  return null;
};
