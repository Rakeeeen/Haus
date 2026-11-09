import React, { useEffect, useRef } from 'react';
import { useFirebaseSync } from '@/data/useFirebaseSync';
import { usePrayer } from '@/data/usePrayer';
import { readStored, writeStored } from '@/data/dataScope';
import { POMODORO_WEEKLY_MOCK } from '@/constants/mockData';
import { getDayMoments } from '@/domain/devotion/prayer';
import type { FocusDayStats, FocusWeekDay } from '@/domain/focus/session';

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
    // Wait until ALL Firebase sync hooks are ready before checking whether to reset
    if (
      !glassesReady ||
      !historyReady ||
      !pomoReady ||
      !pomoWeekReady ||
      !pomoHistoryReady ||
      !lastResetDateReady ||
      !lastPomoIshaResetDateReady
    ) {
      return;
    }

    const performReset = async (maghribMoment: Date) => {
      // We calculate the logical "yesterday" relative to the Maghrib moment
      const lastDateStr = new Date(maghribMoment.getTime() - 12 * 60 * 60 * 1000).toDateString();

      // Read the freshest value straight from localStorage instead of React state,
      // which can lag behind what Water.tsx just wrote (a Firestore-listener state
      // update isn't guaranteed to have flushed yet), causing the archived tally to
      // be recorded as 0.
      const currentGlasses = Number(readStored<number>('hydration_glasses', 0)) || 0;

      if (currentGlasses > 0) {
        setHistory(prev => ({ ...(prev || {}), [lastDateStr]: currentGlasses }));
      }
      setGlasses(0);
    };

    const dayIdxOf = (d: Date) => (d.getDay() + 6) % 7; // Mon-Sun

    const readFreshPomoWeek = (): FocusWeekDay[] => {
      const parsed = readStored<FocusWeekDay[] | null>('pomodoro_week', null);
      return Array.isArray(parsed) && parsed.length === 7 ? parsed : POMODORO_WEEKLY_MOCK;
    };

    const checkPomoReset = () => {
      const now = new Date();
      const todayDateStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toDateString();

      // Isha is the single close-out action for the day: snapshot today's progress
      // into history, then zero the counter. Focus is locked Isha→Fajr (see
      // Pomodoro.tsx), so nothing can accumulate after this point — no separate
      // "merge the leftover at midnight" step is needed. Uses the same prayer-time fallbacks
      // as the Focus lock itself if the times haven't loaded yet.
      const todayIsha = getDayMoments(prayerTimes, now).isha;

      if (now.getTime() >= todayIsha && lastPomoIshaResetDate !== todayDateStr && firedPomoIshaMarkerRef.current !== todayDateStr) {
        firedPomoIshaMarkerRef.current = todayDateStr;
        writeStored('system_last_pomo_reset_date', todayDateStr);

        const todayIdx = dayIdxOf(now);
        const freshWeek = readFreshPomoWeek();
        const todayPomo = freshWeek[todayIdx] || { sessions: 0, minutes: 0 };

        if (todayPomo.sessions > 0) {
          setPomoHistory(prev => ({ ...(prev || {}), [todayDateStr]: { sessions: todayPomo.sessions, minutes: todayPomo.minutes || 0 } }));
        }
        setPomoSessions(0);

        // Friday's Isha is the last close-out before the week rolls over — start the
        // new week's display array fresh instead of just zeroing today's slot.
        if (todayIdx === 4) {
          setPomoWeek(POMODORO_WEEKLY_MOCK);
        } else {
          setPomoWeek(freshWeek.map((d, i) => i === todayIdx ? { sessions: 0, minutes: 0 } : d));
        }
        setLastPomoIshaResetDate(todayDateStr);
      }
    };

    const checkReset = () => {
      const now = new Date();
      // "Today's logical day" ends at the real Maghrib time (6:00 PM if prayer times haven't
      // loaded yet). Before that moment we're still finishing yesterday's logical day;
      // at/after it we've crossed into today's.
      const todayMaghrib = new Date(getDayMoments(prayerTimes, now).maghrib);
      const resetDateBase = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (now < todayMaghrib) {
        resetDateBase.setDate(resetDateBase.getDate() - 1);
      }
      const resetMarker = resetDateBase.toDateString();

      if (lastResetDate !== resetMarker && firedResetMarkerRef.current !== resetMarker) {
        firedResetMarkerRef.current = resetMarker;
        // Write value + updatedAt synchronously (mirrors useFirebaseSync's setValue) so a
        // refresh mid-reset sees the marker AND the Firestore listener won't clobber it
        // back with the stale server value once it connects.
        writeStored('system_last_reset_date', resetMarker);
        const maghribMoment = new Date(resetDateBase);
        maghribMoment.setHours(todayMaghrib.getHours(), todayMaghrib.getMinutes(), 0, 0);
        performReset(maghribMoment);
        setLastResetDate(resetMarker);
      }
    };

    const runChecks = () => {
      checkReset();
      checkPomoReset();
    };

    const interval = setInterval(runChecks, 2 * 60 * 1000); // Check every 2 minutes
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
