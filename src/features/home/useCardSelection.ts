import { useEffect, useRef, useState } from 'react';

export type CardId = 'time' | 'water' | 'pomodoro' | 'finance' | 'tasks';

/** How long a manually-picked card stays before the dock snaps back to the system's pick. */
const CARD_REVERT_MS = 30_000;

// Remembered across visits to Home, so coming back starts on the card you left (no flash of another one).
let lastActiveCardId: CardId = 'time';

/**
 * Which card the big card shows. The system has a pick — Time by default, Focus while a session runs after Fajr — and you
 * can pick another by clicking; your pick holds for 30 s and then the dock goes back to the system's.
 * `displayedCardId` trails `activeCardId` by a short fade, so the big card changes content while it is invisible.
 */
export function useCardSelection(opts: { focusRunning: boolean; beforeFajr: boolean; now: Date }) {
  const { focusRunning, beforeFajr, now } = opts;
  const [activeCardId, setActiveCardId] = useState<CardId>(() => lastActiveCardId);
  const [displayedCardId, setDisplayedCardId] = useState<CardId>(() => lastActiveCardId);
  const [bigCardVisible, setBigCardVisible] = useState(false);
  const [lastManualClickTime, setLastManualClickTime] = useState(0);
  // The card with system priority, whatever is being looked at (the dock's arrow points at it).
  const [systemCardId, setSystemCardId] = useState<CardId | null>(null);
  // The first reveal happens once the auto-select below has run; only after it do changes fade.
  const firstRevealDoneRef = useRef(false);

  // The big card fades out, swaps what it shows, and fades back in (only after the first reveal).
  useEffect(() => {
    lastActiveCardId = activeCardId;
    if (!firstRevealDoneRef.current) return;
    if (activeCardId !== displayedCardId) {
      setBigCardVisible(false);
      const t = setTimeout(() => {
        setDisplayedCardId(activeCardId);
        setBigCardVisible(true);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [activeCardId]);

  // Time is the default and always wins before Fajr — even over a running focus session. After Fajr a running (or overtime)
  // focus session takes over until it ends, then it is back to Time.
  useEffect(() => {
    const priorityCardId: 'pomodoro' | null = !beforeFajr && focusRunning ? 'pomodoro' : null;
    const targetCardId: CardId = priorityCardId ?? 'time';
    setSystemCardId(targetCardId);

    if (!firstRevealDoneRef.current) {
      firstRevealDoneRef.current = true;
      lastActiveCardId = targetCardId;
      setDisplayedCardId(targetCardId);
      setActiveCardId(targetCardId);
      requestAnimationFrame(() => setBigCardVisible(true));
      return;
    }

    // Later auto-selects only when you haven't picked a card in the last 30 s. `now` has to be a dependency: otherwise
    // nothing re-runs this once the 30 s have passed, and a manual pick would stick forever.
    if (now.getTime() - lastManualClickTime < CARD_REVERT_MS) return;
    if (activeCardId !== targetCardId) setActiveCardId(targetCardId);
  }, [focusRunning, beforeFajr, lastManualClickTime, activeCardId, now]);

  const pickCard = (id: CardId) => {
    setActiveCardId(id);
    setLastManualClickTime(Date.now());
  };

  return { activeCardId, displayedCardId, bigCardVisible, systemCardId, pickCard };
}
