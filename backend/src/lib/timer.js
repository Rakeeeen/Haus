// Ported from src/domain/focus/session.ts (advanceTimer) — keep in sync by hand.
// A checkpoint is a snapshot taken at `at`; a running timer has moved on since, so a reader carries it forward to now. The web
// app's tab refreshes the snapshot about once a minute, so this is what makes what Discord shows (and what the bot writes back
// on Pause / Done) right to the second instead of up to a heartbeat behind.

/** The longest a running snapshot is carried forward; older than this, its tab has gone and the timer stays where it was left. */
export const CHECKPOINT_MAX_ADVANCE_S = 150;

/** @param {{ running: boolean, isOvertime: boolean, timeLeft: number, overtime: number }} state */
export function advanceTimer(state, at, now) {
  if (!state.running || typeof at !== 'number') return state;
  const elapsed = Math.min(CHECKPOINT_MAX_ADVANCE_S, Math.max(0, Math.floor((now - at) / 1000)));
  if (elapsed === 0) return state;
  return state.isOvertime
    ? { ...state, overtime: (state.overtime || 0) + elapsed }
    : { ...state, timeLeft: Math.max(0, (state.timeLeft || 0) - elapsed) };
}
