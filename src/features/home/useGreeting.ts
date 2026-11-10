import { useEffect, useRef, useState } from 'react';
import { weekPatternOf, type DaySnapshot } from '@/domain/dailyJournal';
import { getOccasionLine, type HijriDate } from '@/domain/devotion/occasion';
import { getDayPhase, type NextPrayer, type PrayerTimes } from '@/domain/devotion/prayer';
import {
  daysSinceActive, getAbsenceLine, getAchievement, getLiveFocusLine, getProgressLine, getWeatherLine, pickHeader, type Achievement,
  type Weather,
} from '@/domain/greeting';

/** The names Hamed is greeted by, in turn. */
const OWNER_NAMES = ['Hamed', 'Ghorab', 'Shahyn', 'Rakeeen'];
// Remembered across visits to Home, so the name doesn't change on every remount.
let persistedOwnerName = OWNER_NAMES[Math.floor(Math.random() * OWNER_NAMES.length)];

export interface GreetingParts { before: string; name: string; after: string; achievement: Achievement | null }

/** What the greeting is built from: the day so far, the focus session, the prayer times and the weather. */
export interface GreetingInput {
  isOwner: boolean;
  guestFirstName: string;
  now: Date;
  glasses: number;
  focusMinutes: number;
  session: { mode: string; running: boolean; overtime: boolean; timeLeft: number; overtimeSeconds: number; totalSecs: number };
  times: PrayerTimes | undefined;
  hijriDate: HijriDate | null;
  nextPrayer: NextPrayer | null;
  weather: Weather | null;
  dailyHistory: Record<string, DaySnapshot>;
  todayKey: string;
  /** The evening journal line, when there is one: it replaces the greeting for those minutes. */
  journalEntry: string | null;
}

/**
 * The header line. The phrase follows the real prayer times (not fixed clock hours), the day's numbers and the weather; when
 * it changes it fades out, swaps, and fades back in — and Hamed is greeted by another of his names each time (a guest only by
 * their own). The journal line, when shown, goes through the same single fade, so two changes close together can't leave it hidden.
 */
export function useGreeting(input: GreetingInput) {
  const { isOwner, guestFirstName, now, glasses, focusMinutes, session, times, hijriDate, nextPrayer, weather, dailyHistory, todayKey, journalEntry } = input;
  const names = isOwner ? OWNER_NAMES : [guestFirstName];
  const [greetingName, setGreetingName] = useState(() => (isOwner ? persistedOwnerName : guestFirstName));

  const build = (): GreetingParts => {
    // A focus session only reaches `focusMinutes` on Done, so the running one is counted on top.
    const sessionActive = session.mode === 'focus' && (session.running || session.overtime);
    const sessionElapsedMin = sessionActive
      ? Math.floor((session.overtime ? session.totalSecs + session.overtimeSeconds : session.totalSecs - session.timeLeft) / 60)
      : 0;
    const phase = getDayPhase(times, now);
    const { text: before, achievement } = pickHeader({
      achievement: getAchievement(glasses || 0, focusMinutes + sessionElapsedMin),
      phase,
      liveFocus: sessionActive
        ? getLiveFocusLine({ elapsedMin: sessionElapsedMin, remainingMin: session.overtime ? 0 : session.timeLeft / 60, savedTodayMin: focusMinutes })
        : null,
      prayerImminent: !!nextPrayer && nextPrayer.name !== 'Fajr' && nextPrayer.remainingMinutes < 10,
      occasion: getOccasionLine(times, hijriDate, now),
      absence: getAbsenceLine(daysSinceActive(dailyHistory, todayKey), !glasses && focusMinutes === 0 && !session.running),
      weekPattern: weekPatternOf(dailyHistory, now),
      weather: getWeatherLine(weather, phase),
      progress: getProgressLine(glasses || 0, focusMinutes + sessionElapsedMin, phase),
      glasses: glasses || 0,
      focusMinutes,
      focusRunning: session.running,
      isFriday: now.getDay() === 5,
      now,
    });
    return { before, name: greetingName.toUpperCase(), after: '', achievement };
  };

  const parts = build();
  const [displayed, setDisplayed] = useState(parts);
  const displayedRef = useRef(displayed);
  displayedRef.current = displayed;
  const [visible, setVisible] = useState(true);

  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = `${parts.achievement?.kind ?? ''}|${parts.before}`;
  const shownKeyRef = useRef<string>(journalEntry ?? key);
  useEffect(() => {
    const nextKey = journalEntry ?? key;
    if (shownKeyRef.current === nextKey) return;
    shownKeyRef.current = nextKey;

    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    setVisible(false);
    fadeTimeoutRef.current = setTimeout(() => {
      const prev = displayedRef.current;
      const changed = !journalEntry && !(prev.before === parts.before && prev.achievement?.kind === parts.achievement?.kind);
      if (changed) {
        const others = names.filter((n) => n.toUpperCase() !== prev.name);
        const nextName = others.length ? others[Math.floor(Math.random() * others.length)] : prev.name;
        if (isOwner) persistedOwnerName = nextName;
        setGreetingName(nextName);
        setDisplayed({ before: parts.before, name: nextName.toUpperCase(), after: '', achievement: parts.achievement });
      }
      setVisible(true);
      fadeTimeoutRef.current = null;
    }, 550);

    return () => {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, [journalEntry, key]);

  return { displayed, visible };
}
