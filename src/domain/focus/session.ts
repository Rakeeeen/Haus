/** Rules for a focus session. */

/**
 * A break is 20% of the focus time just completed (base + overtime),
 * rounded, never shorter than a minute.
 *   25m focus → 5m    ·   50m → 10m   ·   3m → 1m
 */
export function breakMinutesFor(focusGainedMinutes: number): number {
  return Math.max(1, Math.round(focusGainedMinutes * 0.2));
}

/** One day of Focus: how many sessions were finished and how many minutes they added up to. */
export interface FocusDayStats {
  sessions: number;
  minutes: number;
}

/** A day in the Focus week array. The seed data only has `sessions`; `minutes` appears once something is logged. */
export interface FocusWeekDay {
  day?: string;
  sessions: number;
  minutes?: number;
}

/** What the app tells the Discord bot happened in a focus session; the bot turns it into a message. */
export interface FocusNotification {
  /** Unique per event, so the bot posts each one once. */
  id: string;
  type: 'focus_timer_up' | 'focus_complete' | 'break_complete';
  /** The session's goal, in minutes. */
  focusMinutes: number;
  /** Time past the goal, in seconds (0 unless the session ran over). */
  overtimeSeconds: number;
  at: string;             // ISO
}

/** One finished session in today's log. */
export interface FocusLogEntry {
  time: string;
  duration: number;
}

/** The week with one more session, of `focusedMinutes`, counted on day `dayIndex`. Doesn't mutate `week`. */
export function recordSession(week: FocusWeekDay[], dayIndex: number, focusedMinutes: number): FocusWeekDay[] {
  return week.map((day, i) =>
    i === dayIndex ? { ...day, sessions: day.sessions + 1, minutes: (day.minutes || 0) + focusedMinutes } : day,
  );
}

/** The week as stored, or `seed` when what is stored isn't a full week (a missing or half-written value). */
export function weekOrSeed(stored: unknown, seed: FocusWeekDay[]): FocusWeekDay[] {
  return Array.isArray(stored) && stored.length === 7 ? (stored as FocusWeekDay[]) : seed;
}

/** What the timer is doing: all five numbers that describe it at an instant. */
export interface TimerState {
  /** Seconds left in the current session or break. */
  timeLeft: number;
  /** Seconds past the end of a focus session. */
  overtime: number;
  isOvertime: boolean;
  running: boolean;
  mode: 'focus' | 'break';
}

/** A snapshot of the timer kept in Firestore, so a reload (or another device, or the bot) can pick it up. */
export interface FocusCheckpoint extends TimerState {
  /** Which tab (or the bot) wrote it, so a tab can tell its own echo from a change made elsewhere. */
  writtenBy?: string;
  /** When (ms since 1970) the numbers above were true. A reader adds the seconds since then to a running timer (`advanceTimer`),
   *  which is what lets the heartbeat be slow: nobody has to wait for the next write to know what the timer shows now. */
  at?: number;
}

/**
 * The longest stretch a running snapshot is carried forward. A live tab writes a checkpoint every `CHECKPOINT_HEARTBEAT_MS`, so a
 * snapshot older than this comes from a tab that is gone (closed, crashed, asleep): its timer stops where that tab last saw it
 * instead of counting through hours nobody was there.
 */
export const CHECKPOINT_MAX_ADVANCE_S = 150;

/** How often a running timer's tab refreshes the checkpoint (it is also written on every start/pause/save and when the tab is hidden). */
export const CHECKPOINT_HEARTBEAT_MS = 60_000;

/**
 * The timer as it is `now`, from a snapshot taken at `at`: a running one is carried forward by the seconds since (at most
 * `CHECKPOINT_MAX_ADVANCE_S`); a paused one, or a snapshot with no `at` (written before this existed), is as it was written.
 */
export function advanceTimer(state: TimerState, at: number | undefined, now: number): TimerState {
  if (!state.running || typeof at !== 'number') return state;
  const elapsed = Math.min(CHECKPOINT_MAX_ADVANCE_S, Math.max(0, Math.floor((now - at) / 1000)));
  if (elapsed === 0) return state;
  return state.isOvertime
    ? { ...state, overtime: state.overtime + elapsed }
    : { ...state, timeLeft: Math.max(0, state.timeLeft - elapsed) };
}

/** Nothing running: a fresh focus session waiting to start. */
export const idleTimer = (focusMinutes: number): TimerState => ({
  timeLeft: focusMinutes * 60, overtime: 0, isOvertime: false, running: false, mode: 'focus',
});

/** A new focus session, already counting down. */
export const newSessionTimer = (focusMinutes: number): TimerState => ({ ...idleTimer(focusMinutes), running: true });

/** A break of `breakMinutes`, already counting down. */
export const breakTimer = (breakMinutes: number): TimerState => ({
  timeLeft: breakMinutes * 60, overtime: 0, isOvertime: false, running: true, mode: 'break',
});

/** Minutes of focus in a session whose timer ran out and then ran on for `overtimeSeconds`. */
export const minutesWithOvertime = (focusMinutes: number, overtimeSeconds: number): number =>
  focusMinutes + Math.floor(overtimeSeconds / 60);

/** Minutes of focus so far in a session saved before (or after) its end — at least one. */
export const minutesSoFar = (focusMinutes: number, timeLeftSeconds: number, overtimeSeconds: number): number =>
  Math.max(1, Math.floor((focusMinutes * 60 - timeLeftSeconds + overtimeSeconds) / 60));

/** Friday (Mon = 0 … Sun = 6) — the last day of the Focus week: its Isha close-out starts the next week. */
const LAST_WEEKDAY_INDEX = 4;

/**
 * Closing out a focus day at Isha: what goes into the history (nothing, if no session was done) and what the week shows
 * after it — today's slot zeroed, or, after Friday's Isha, the whole week started fresh from `seed`.
 */
export function closeOutFocusDay(
  week: FocusWeekDay[],
  dayIndex: number,
  seed: FocusWeekDay[],
): { archived: FocusDayStats | null; nextWeek: FocusWeekDay[] } {
  const today = week[dayIndex] || { sessions: 0, minutes: 0 };
  return {
    archived: today.sessions > 0 ? { sessions: today.sessions, minutes: today.minutes || 0 } : null,
    nextWeek: dayIndex === LAST_WEEKDAY_INDEX ? seed : week.map((day, i) => (i === dayIndex ? { sessions: 0, minutes: 0 } : day)),
  };
}
