/** What a day left behind, for the journal line and the greeting's sense of the week. Pure: the page reads the history and the clock. */
export interface DaySnapshot { water: number; focus: number; workout: number }

export type WeekPattern = 'momentum' | 'slump' | 'rising' | 'fading' | 'neutral';

/** "2026-11-09" for a Date, as the daily history is keyed (the UTC date, like every other key written there). */
export const historyKey = (d: Date): string => d.toISOString().slice(0, 10);

/** "2026-11-09" from a Date's local year, month and day (no UTC offset). */
export const localDayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Whether the day has anything worth writing down. */
export const hasActivity = (snap: DaySnapshot): boolean => snap.water > 0 || snap.focus > 0 || snap.workout > 0;

/**
 * How the last week has gone, from the last seven days of history (newest first): at least three recorded days are needed
 * to say anything. A day scores one for 8+ glasses and one for 30+ focus minutes; the last three days are compared with the
 * four before them.
 */
export function weekPatternOf(history: Record<string, DaySnapshot>, now: Date = new Date()): WeekPattern {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    return history[historyKey(d)] ?? null;
  }).filter((d): d is DaySnapshot => d !== null);

  if (days.length < 3) return 'neutral';

  const score = (d: DaySnapshot) => (d.water >= 8 ? 1 : 0) + (d.focus >= 30 ? 1 : 0);
  const recent = days.slice(0, 3).map(score);
  const older = days.slice(3).map(score);

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.length ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;

  if (recent.every((s) => s >= 2)) return 'momentum';
  if (recent.every((s) => s === 0)) return 'slump';
  if (recentAvg > olderAvg + 0.5) return 'rising';
  if (recentAvg < olderAvg - 0.5) return 'fading';
  return 'neutral';
}

/**
 * One line for a day's journal: "November 9 — water was decent, focus ran 45m." Fitness is left out of it for now (the
 * workout tracking is switched off system-wide).
 */
export function journalEntryFor(dateKey: string, data: DaySnapshot): string {
  const date = new Date(`${dateKey}T12:00:00`);
  const dateText = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const water = data.water >= 10 ? 'water was strong' : data.water >= 6 ? 'water was decent' : data.water > 0 ? 'water was low' : 'no water logged';
  const focus = data.focus >= 60 ? `focus ran ${Math.round(data.focus / 60)}h` : data.focus > 0 ? `focus ran ${data.focus}m` : 'no focus';
  return `${dateText} — ${water}, ${focus}.`;
}
