import { useEffect, useMemo, useRef } from 'react';
import { useFirebaseSync } from '@/data/useFirebaseSync';
import { getLogicalDate } from '@/domain/day';
import { hasActivity, historyKey, journalEntryFor, localDayKey, type DaySnapshot } from '@/domain/dailyJournal';

/** Fitness tracking is switched off (2026-09); the history keeps its `workout` field for older records, and new days record 0. */
const WORKOUT_MINUTES_TODAY = 0;

/**
 * Keeps the daily history (water, focus per day) and the one-line journal: saves today's numbers as they change, writes
 * yesterday's line when the day rolls over, and tells the header what to say in the evening (20:00–20:30, before sleep).
 */
export function useDailySnapshot(glasses: number, focusMinutes: number, now: Date) {
  const [dailyHistory, setDailyHistory, dailyHistoryReady] = useFirebaseSync<Record<string, DaySnapshot>>('daily_history', {});
  const [dailyJournal, setDailyJournal] = useFirebaseSync<Record<string, string>>('daily_journal', {});
  const todayKey = historyKey(getLogicalDate());

  // IMPORTANT: wait for dailyHistoryReady — if we write before Firestore loads, `prev` is {} and we would overwrite
  // every past day with only today's.
  useEffect(() => {
    if (!dailyHistoryReady) return;
    if (glasses === 0 && focusMinutes === 0 && WORKOUT_MINUTES_TODAY === 0) return;
    setDailyHistory((prev) => {
      const existing = prev[todayKey] ?? { water: 0, focus: 0, workout: 0 };
      return {
        ...prev,
        [todayKey]: {
          water: Math.max(existing.water, glasses || 0),
          focus: Math.max(existing.focus, focusMinutes),
          workout: Math.max(existing.workout, WORKOUT_MINUTES_TODAY),
        },
      };
    });
  }, [glasses, focusMinutes, dailyHistoryReady]);

  // Write yesterday's journal line when the day rolls over.
  const previousDayRef = useRef(historyKey(getLogicalDate()));
  useEffect(() => {
    const interval = setInterval(() => {
      const currentDay = historyKey(getLogicalDate());
      if (currentDay === previousDayRef.current) return;
      const yesterdayKey = previousDayRef.current;
      previousDayRef.current = currentDay;
      const snap = dailyHistory[yesterdayKey];
      if (snap && !dailyJournal[yesterdayKey]) {
        setDailyJournal((prev) => ({ ...prev, [yesterdayKey]: journalEntryFor(yesterdayKey, snap) }));
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [dailyHistory, dailyJournal]);

  // Today's line is rewritten whenever the numbers change, so a change in its wording applies at once.
  useEffect(() => {
    const snap = dailyHistory[todayKey];
    if (!snap || !hasActivity(snap)) return;
    const entry = journalEntryFor(todayKey, snap);
    if (dailyJournal[todayKey] === entry) return;
    setDailyJournal((prev) => ({ ...prev, [todayKey]: entry }));
  }, [dailyHistory, todayKey]);

  // The evening summary shown in the header: the saved line, or one made on the spot from today's history.
  const isJournalTime = now.getHours() === 20 && now.getMinutes() < 30;
  const localKey = localDayKey(now);
  const journalEntry = useMemo(() => {
    if (!isJournalTime) return null;
    if (dailyJournal[localKey]) return dailyJournal[localKey];
    const snap = dailyHistory[localKey];
    return snap && hasActivity(snap) ? journalEntryFor(localKey, snap) : null;
  }, [isJournalTime, dailyJournal, dailyHistory, localKey]);

  return { dailyHistory, todayKey, journalEntry };
}
