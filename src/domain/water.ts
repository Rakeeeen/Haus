import { getDayMoments, type PrayerTimes } from '@/domain/devotion/prayer';

/**
 * Water closes at Maghrib: the day's tally is archived into `hydration_history` and the live
 * counter is zeroed (see DailyResetManager). A glass drunk after that still belongs to the day
 * that just closed — these two functions put it there.
 */

/**
 * The `hydration_history` key of the day the Maghrib reset closes out: today's date from Maghrib
 * until midnight, yesterday's from midnight until the next Maghrib. Same rule as DailyResetManager.
 */
export function archivedDayKey(times: PrayerTimes | undefined, now: Date = new Date()): string {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getTime() < getDayMoments(times, now).maghrib) day.setDate(day.getDate() - 1);
  return day.toDateString();
}

export interface WaterTally {
  glasses: number;
  history: Record<string, number>;
}

/**
 * Adds one glass to the closed day `dayKey`. If the Maghrib reset hasn't run for that day yet
 * (`lastResetDate` is behind), the glass goes on the live counter instead — the reset archives
 * that counter by overwriting the day's history entry, so a glass written there first would be lost.
 */
export function applyLateGlass(tally: WaterTally, lastResetDate: string, dayKey: string): WaterTally {
  if (lastResetDate !== dayKey) return { ...tally, glasses: tally.glasses + 1 };
  return { ...tally, history: { ...tally.history, [dayKey]: (tally.history[dayKey] || 0) + 1 } };
}
