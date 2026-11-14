import { getDayMoments, isFocusNightLocked, isWaterClosed, type PrayerTimes } from '@/domain/devotion/prayer';
import { archivedDayKey } from '@/domain/water';

/**
 * When a day closes — water and focus — depends on who is looking.
 *
 * Hamed's day follows the real prayer times: water closes at Maghrib, focus at Isha, both reopen at Fajr.
 * Everyone else's is the calendar day: it closes at midnight (the day's tally is archived and the counters zeroed) and the
 * two stay locked until Fajr. A glass drunk in that gap still goes to the day that just closed, as it does for Hamed.
 */
export type DayRole = 'owner' | 'guest';

const startOfDay = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate());
const yesterdayOf = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
/** Mon = 0 … Sun = 6, as the focus week is laid out. */
const mondayFirst = (day: Date) => (day.getDay() + 6) % 7;

/** Whether water is closed: Maghrib→Fajr for Hamed, midnight→Fajr for a guest. */
export function isWaterClosedFor(role: DayRole, times: PrayerTimes | undefined, now: Date = new Date()): boolean {
  if (role === 'owner') return isWaterClosed(times, now);
  return now.getTime() < getDayMoments(times, now).fajr;
}

/** Whether a new focus session can't start: Isha→Fajr for Hamed, midnight→Fajr for a guest. */
export function isFocusNightLockedFor(role: DayRole, times: PrayerTimes | undefined, now: Date = new Date()): boolean {
  if (role === 'owner') return isFocusNightLocked(times, now);
  return now.getTime() < getDayMoments(times, now).fajr;
}

/**
 * The `hydration_history` key of the day the last water close-out closed (also the marker that says it ran): Hamed's changes at
 * Maghrib; a guest's is always yesterday's, because their day closed at the last midnight.
 */
export function closedWaterDayKey(role: DayRole, times: PrayerTimes | undefined, now: Date = new Date()): string {
  if (role === 'owner') return archivedDayKey(times, now);
  return yesterdayOf(now).toDateString();
}

export interface FocusCloseOut {
  /** Whether the day's focus close-out is due yet. */
  due: boolean;
  /** The day it closes (a `toDateString()`), which is also its history key and the marker that says it ran. */
  key: string;
  /** That day's slot in the focus week (Mon = 0). */
  dayIndex: number;
}

/** The focus close-out: Hamed's today at Isha; a guest's yesterday, as soon as the day has turned. */
export function focusCloseOut(role: DayRole, times: PrayerTimes | undefined, now: Date = new Date()): FocusCloseOut {
  if (role === 'owner') {
    return { due: now.getTime() >= getDayMoments(times, now).isha, key: startOfDay(now).toDateString(), dayIndex: mondayFirst(now) };
  }
  const closed = yesterdayOf(now);
  return { due: true, key: closed.toDateString(), dayIndex: mondayFirst(closed) };
}
