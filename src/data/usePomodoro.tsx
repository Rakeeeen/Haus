import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useFirebaseSync } from '@/data/useFirebaseSync';
import { usePrayer } from '@/data/usePrayer';
import { POMODORO_WEEKLY_MOCK } from '@/constants/mockData';
import { getPomoTodayIdx } from '@/domain/day';
import { getDayMoments } from '@/domain/devotion/prayer';
import {
  advanceTimer, breakMinutesFor, breakTimer, CHECKPOINT_HEARTBEAT_MS, idleTimer, minutesSoFar, minutesWithOvertime, newSessionTimer, recordSession, weekOrSeed,
  type FocusCheckpoint, type FocusDayStats, type FocusLogEntry, type FocusNotification, type FocusWeekDay, type TimerState,
} from '@/domain/focus/session';

interface PomodoroContextType {
  timeLeft: number;
  overtime: number;
  isOvertime: boolean;
  running: boolean;
  mode: 'focus' | 'break';
  sessions: number;
  weekStats: FocusWeekDay[];
  logs: FocusLogEntry[];
  history: Record<string, FocusDayStats & { logs?: FocusLogEntry[] }>;
  todayIdx: number;
  focusDuration: number;
  breakDuration: number;
  setWeekStats: (v: FocusWeekDay[]) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  startBreak: () => void;
  startNewSession: () => void;
  skipBreak: () => void;
  saveProgress: () => void;
}

const PomodoroContext = createContext<PomodoroContextType | null>(null);

/** Focus sessions are always this long (minutes). */
const FOCUS_MINUTES = 25;
/** How often the running timer checks the clock: often, but it counts from timestamps, so a throttled background tab loses nothing. */
const TICK_MS = 200;
/**
 * The checkpoint carries the time it was taken (`at`), so whoever reads it (another tab, the Discord bot) works out what the
 * timer shows now (`advanceTimer`) — the heartbeat is only there to say "this tab is still alive". It used to be every 3 s, about
 * 1200 writes an hour, each one also read by every other open tab: that was most of the day's writes.
 */
const CHECKPOINT_EVERY_MS = CHECKPOINT_HEARTBEAT_MS;
/** A tab that is hidden writes a checkpoint, but not more than once in this long (switching tabs back and forth isn't a write each time). */
const HIDDEN_WRITE_GAP_MS = 5_000;
const ISHA_CHECK_EVERY_MS = 30_000;

/** The time of day as the log shows it: "9:41 AM". */
const clockTime = (at: Date) => at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

/**
 * The Pomodoro timer, shared by the Focus page, the Home card and the floating timer. It counts from timestamps (so a hidden tab
 * can't make it lose time), keeps a checkpoint in Firestore (so a reload, another device or the Discord bot can take over), and
 * tells the bot — through Firestore, so no webhook secret ships in the website — when a session ends.
 */
export const PomodoroProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const focusDuration = FOCUS_MINUTES;
  const [breakDuration, setBreakDuration] = useState(5);
  const [timeLeft, setTimeLeft] = useState(focusDuration * 60);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [overtime, setOvertime] = useState(0);
  const [isOvertime, setIsOvertime] = useState(false);

  const [sessions, setSessions] = useFirebaseSync<number>('pomodoro_sessions', 0);
  const [rawWeekStats, setWeekStats] = useFirebaseSync<FocusWeekDay[]>('pomodoro_week', POMODORO_WEEKLY_MOCK);
  const weekStats = weekOrSeed(rawWeekStats, POMODORO_WEEKLY_MOCK);
  const [logs, setLogs] = useFirebaseSync<FocusLogEntry[]>('pomodoro_logs', []);
  const [history] = useFirebaseSync<Record<string, FocusDayStats & { logs?: FocusLogEntry[] }>>('pomodoro_history', {});
  const [, setNotification] = useFirebaseSync<FocusNotification | null>('focus_notification', null);
  const todayIdx = getPomoTodayIdx();

  /** Puts all five timer numbers at once. */
  const applyTimer = useCallback((state: TimerState) => {
    setTimeLeft(state.timeLeft);
    setOvertime(state.overtime);
    setIsOvertime(state.isOvertime);
    setMode(state.mode);
    setRunning(state.running);
  }, []);

  // ── The checkpoint ───────────────────────────────────────────────────────────────────────────────
  // A snapshot of the in-progress timer, so a reload or crash mid-session doesn't lose everything since the last completed
  // session (once ~5 h of focus was lost because nothing was saved until "take a break"/"save").
  //
  // `writtenBy` tags who wrote it — a random id per tab load, or the fixed name the bot uses. It is how this tab tells "my own
  // periodic write echoing back through Firestore's listener" from "something else (another device, the bot) changed this".
  // Comparing values doesn't work: a remote pause a second after a remote start writes a value this tab could have produced.
  const [checkpoint, setCheckpoint, checkpointReady] = useFirebaseSync<FocusCheckpoint | null>('pomodoro_checkpoint', null);
  const instanceId = useRef<string>(crypto.randomUUID());
  const hydratedFromCheckpoint = useRef(false);
  /** The timer as it is now, readable from timers and listeners without re-creating them on every tick. */
  const liveTimer = useRef<TimerState>({ timeLeft, overtime, isOvertime, running, mode });
  useEffect(() => { liveTimer.current = { timeLeft, overtime, isOvertime, running, mode }; }, [timeLeft, overtime, isOvertime, running, mode]);

  const lastWrite = useRef(0);
  const writeCheckpoint = useCallback((state: TimerState = liveTimer.current) => {
    lastWrite.current = Date.now();
    setCheckpoint({ ...state, writtenBy: instanceId.current, at: lastWrite.current });
  }, [setCheckpoint]);

  // On first mount, adopt whatever checkpoint exists (reload/crash recovery). After that, keep adopting later changes — except
  // this tab's own echoes. Anything external is adopted at once and unconditionally, so a remote Start/Pause/Done takes effect
  // on an already-open tab without a reload.
  //
  // Two things this must get right, both found the hard way:
  // 1. Wait for `checkpointReady`. The value is seeded from localStorage before Firestore confirms anything, and may be stale
  //    (a leftover "running" snapshot from a session that has since ended elsewhere). Worse, once adopted, this tab's own
  //    heartbeat writes a fresh `updatedAt`, so useFirebaseSync's "newest write wins" merge would reject Firestore's real
  //    correction for good, and the stale session would just keep ticking.
  // 2. `null` is a real value (idle), not "nothing yet": it must be applied too, so a genuine external clear (the bot's Discard)
  //    takes this tab back to idle instead of leaving it as it was.
  useEffect(() => {
    if (!checkpointReady) return;
    const isFirstRun = !hydratedFromCheckpoint.current;
    hydratedFromCheckpoint.current = true;
    if (!isFirstRun && checkpoint?.writtenBy === instanceId.current) return;
    // A running snapshot is carried forward to now: it was taken up to a heartbeat ago.
    applyTimer(checkpoint ? advanceTimer(checkpoint, checkpoint.at, Date.now()) : idleTimer(focusDuration));
  }, [checkpoint, checkpointReady, focusDuration, applyTimer]);

  // ── Telling the bot ──────────────────────────────────────────────────────────────────────────────
  const notifyFocus = useCallback((type: FocusNotification['type'], overtimeSeconds = 0) => {
    void setNotification({ id: crypto.randomUUID(), type, focusMinutes: focusDuration, overtimeSeconds, at: new Date().toISOString() });
  }, [focusDuration, setNotification]);

  /** A finished focus session: one more session, a log line, today's minutes, and the bot told with the full time (base + overtime). */
  const recordFinishedSession = useCallback((minutes: number, overtimeSeconds: number, at: Date = new Date()) => {
    setSessions((s) => s + 1);
    setLogs((l) => [{ time: clockTime(at), duration: minutes }, ...l]);
    notifyFocus('focus_complete', overtimeSeconds);
    setWeekStats(recordSession(weekStats, todayIdx, minutes));
  }, [weekStats, todayIdx, setSessions, setLogs, setWeekStats, notifyFocus]);

  /** Ends a focus session that ran `minutes`: records it and goes into a break of a fifth of that. */
  const finishIntoBreak = useCallback((minutes: number, overtimeSeconds: number) => {
    const breakMinutes = breakMinutesFor(minutes);
    setBreakDuration(breakMinutes);
    recordFinishedSession(minutes, overtimeSeconds);
    const next = breakTimer(breakMinutes);
    applyTimer(next);
    writeCheckpoint(next);
  }, [recordFinishedSession, applyTimer, writeCheckpoint]);

  // ── The countdown ────────────────────────────────────────────────────────────────────────────────
  // Counted from when it started plus how much was left (or how much overtime there was), never by adding up ticks, so
  // background throttling can't make it lose time.
  const startedAt = useRef<number | null>(null);
  const baseTimeLeft = useRef<number>(timeLeft);
  const baseOvertime = useRef<number>(overtime);

  useEffect(() => {
    if (!running) return;
    startedAt.current = Date.now();
    baseTimeLeft.current = timeLeft;
    baseOvertime.current = overtime;

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000);
      if (isOvertime) {
        setOvertime(baseOvertime.current + elapsed);
        return;
      }
      const left = Math.max(0, baseTimeLeft.current - elapsed);
      setTimeLeft(left);
      if (left > 0) return;
      if (mode === 'focus') {
        // The "time's up" goes to Discord now; the full report waits for "Take a break", to include the overtime.
        setIsOvertime(true);
        notifyFocus('focus_timer_up');
      } else {
        // A break is over. The checkpoint holds only a snapshot, no timestamp, so on reload it would resume counting down the last
        // few seconds it held, in real time, however long ago that was. With `running` now false the writer below stops too and
        // would never persist this — leaving a stale "still on break" checkpoint that replays forever. Clearing it (as reset() does) stops that.
        applyTimer(idleTimer(focusDuration));
        setCheckpoint(null);
        notifyFocus('break_complete');
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [running, mode, isOvertime, notifyFocus, focusDuration, setCheckpoint, applyTimer]);

  // While running: a checkpoint every minute, and one when the tab is hidden.
  useEffect(() => {
    if (!running) return;
    const intervalId = setInterval(() => writeCheckpoint(), CHECKPOINT_EVERY_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && Date.now() - lastWrite.current > HIDDEN_WRITE_GAP_MS) writeCheckpoint();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [running, writeCheckpoint]);

  // ── What the pages can do ────────────────────────────────────────────────────────────────────────
  // Start and pause write the checkpoint at once instead of waiting for the next heartbeat, so a remote reader
  // (the bot) sees a pause made here right away, not "eventually".
  const start = useCallback(() => {
    setRunning(true);
    writeCheckpoint({ ...liveTimer.current, running: true });
  }, [writeCheckpoint]);

  const pause = useCallback(() => {
    setRunning(false);
    writeCheckpoint({ ...liveTimer.current, running: false });
  }, [writeCheckpoint]);

  const goIdle = useCallback(() => {
    applyTimer(idleTimer(focusDuration));
    setCheckpoint(null);
  }, [focusDuration, applyTimer, setCheckpoint]);

  const startNewSession = useCallback(() => {
    const next = newSessionTimer(focusDuration);
    applyTimer(next);
    writeCheckpoint(next);
  }, [focusDuration, applyTimer, writeCheckpoint]);

  /** "Take a break", from overtime: the whole session plus the minutes it ran over. */
  const startBreak = useCallback(() => {
    finishIntoBreak(minutesWithOvertime(focusDuration, overtime), overtime);
  }, [focusDuration, overtime, finishIntoBreak]);

  /** "Done", before the timer ends: what has been focused so far. */
  const saveProgress = useCallback(() => {
    if (mode !== 'focus') return;
    finishIntoBreak(minutesSoFar(focusDuration, timeLeft, overtime), overtime);
  }, [mode, focusDuration, timeLeft, overtime, finishIntoBreak]);

  // Focus is locked from Isha to Fajr (Pomodoro.tsx's `nightLocked`), but that only blocks *starting* a session: one already
  // running (or in overtime) when Isha comes just keeps counting, with no button left to save it. DailyResetManager's Isha
  // close-out can't catch it either: it archives only what was already committed to `pomodoro_week`, never the live timer.
  // So here the session is saved by itself, once a day, and the timer goes idle — not into a break, which is locked too.
  const { times: prayerTimes } = usePrayer();
  const ishaSavedOn = useRef('');
  useEffect(() => {
    if (mode !== 'focus' || !(running || isOvertime)) return;
    const check = () => {
      const now = new Date();
      if (ishaSavedOn.current === now.toDateString()) return;
      if (now.getTime() < getDayMoments(prayerTimes, now).isha) return;
      ishaSavedOn.current = now.toDateString();
      // The live numbers come from the ref, not from this effect's closure: that keeps them out of its deps, so the interval
      // isn't torn down and rebuilt on every countdown tick.
      const live = liveTimer.current;
      recordFinishedSession(minutesSoFar(focusDuration, live.timeLeft, live.overtime), live.overtime, now);
      goIdle();
    };
    const interval = setInterval(check, ISHA_CHECK_EVERY_MS);
    check();
    return () => clearInterval(interval);
  }, [mode, running, isOvertime, prayerTimes, focusDuration, recordFinishedSession, goIdle]);

  // One value object per change, so the pages that read the timer re-render when it changes — not whenever this provider does.
  const value = useMemo<PomodoroContextType>(() => ({
    timeLeft, overtime, isOvertime, running, mode, sessions, weekStats, logs, history, todayIdx,
    focusDuration, breakDuration,
    setWeekStats, start, pause, reset: goIdle, startBreak, startNewSession, skipBreak: goIdle, saveProgress,
  }), [
    timeLeft, overtime, isOvertime, running, mode, sessions, weekStats, logs, history, todayIdx, focusDuration, breakDuration,
    setWeekStats, start, pause, goIdle, startBreak, startNewSession, saveProgress,
  ]);

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>;
};

export const usePomodoro = () => {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error('usePomodoro must be used within PomodoroProvider');
  return ctx;
};
