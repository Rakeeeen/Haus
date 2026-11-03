// Ported from src/domain/water.ts — keep in sync by hand. A glass drunk after Maghrib (when water
// closes and the day is archived) still belongs to the day that just closed.

/** The `hydration_history` key of the day the Maghrib reset closes out (same rule as DailyResetManager). */
export function archivedDayKey(maghrib, now = new Date()) {
  const [h, m] = (maghrib || '18:00').split(':').map(Number);
  const maghribAt = new Date(now);
  maghribAt.setHours(h, m, 0, 0);
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now < maghribAt) day.setDate(day.getDate() - 1);
  return day.toDateString();
}

/**
 * Adds one glass to the closed day `dayKey`. While the web app's Maghrib reset hasn't run for that day
 * yet (`lastResetDate` is behind) the glass goes on the live counter instead — the reset archives that
 * counter by overwriting the day's history entry, so a glass written there first would be lost.
 */
export function applyLateGlass({ glasses, history }, lastResetDate, dayKey) {
  if (lastResetDate !== dayKey) return { glasses: glasses + 1, history };
  return { glasses, history: { ...history, [dayKey]: (history[dayKey] || 0) + 1 } };
}
