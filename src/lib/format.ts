/** Generic value formatting — no Haus domain rules here. */

/** Seconds → `MM:SS` (minutes grow past 99, no leading zero once ≥ 100). */
export function formatTime(sec: number): string {
  const totalMins = Math.floor(sec / 60);
  const m = totalMins >= 100 ? String(totalMins) : String(totalMins).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}
