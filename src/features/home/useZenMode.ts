import { useEffect, useRef, useState } from 'react';
import type { CardId } from '@/features/home/useCardSelection';

/** An undisturbed focus session (or the idle Time card) runs this long before the big card grows to fill the dock's space. */
const ZEN_FIRST_MS = 5 * 60_000;
/** After you wave it off by hovering in from the left edge, it comes back after this. */
const ZEN_RESUME_MS = 3 * 60_000;
/** The edge strip that brings the dock back only starts listening this long after zen engages (see `zenEdgeArmed`). */
const EDGE_ARM_DELAY_MS = 600;

/**
 * ZEN MODE — once a focus session has run undisturbed past the threshold, or the Time card has sat there as the idle view that
 * long, the big card takes over the column: the dock collapses to nothing, the date fades, and the stage grows into the freed
 * height. Hovering in from the left edge drops it back instantly; if the same condition still holds and nothing is touched, it
 * re-expands after `ZEN_RESUME_MS`. The clock follows what is on screen: switching to Water or Finance resets it even if a
 * session runs in the background, since zen is a take-over for whichever card you are looking at, not a timer for the session.
 */
export function useZenMode(opts: { displayedCardId: CardId; focusActive: boolean; now: Date }) {
  const { displayedCardId, focusActive, now } = opts;
  const [zenMode, setZenMode] = useState(false);
  const zenEligible = displayedCardId === 'pomodoro' ? focusActive : displayedCardId === 'time';
  const zenSinceRef = useRef<number | null>(null);
  const zenIsFirstRef = useRef(true);

  useEffect(() => {
    if (zenEligible) {
      if (zenSinceRef.current === null) {
        zenSinceRef.current = Date.now();
        zenIsFirstRef.current = true;
      }
    } else {
      zenSinceRef.current = null;
      setZenMode(false);
    }
  }, [zenEligible]);

  // Rechecked on every tick of `now`, so the threshold fires without a timeout of its own (and can't drift if the tab is hidden).
  useEffect(() => {
    if (!zenEligible || zenMode || zenSinceRef.current === null) return;
    const threshold = zenIsFirstRef.current ? ZEN_FIRST_MS : ZEN_RESUME_MS;
    if (Date.now() - zenSinceRef.current >= threshold) setZenMode(true);
  }, [now, zenEligible, zenMode]);

  const exitZen = () => {
    if (!zenMode) return;
    setZenMode(false);
    zenSinceRef.current = Date.now();
    zenIsFirstRef.current = false;
  };

  const zenActive = zenMode && (displayedCardId === 'pomodoro' || displayedCardId === 'time');

  // The invisible edge strip that reveals the dock on hover only starts listening a moment after zen engages. Without that,
  // a mouse resting where the dock used to be sits on the strip the instant the card expands under it, exits zen, restarts the
  // timer, re-triggers zen, and repeats — the card would flicker instead of settling.
  const [zenEdgeArmed, setZenEdgeArmed] = useState(false);
  useEffect(() => {
    if (!zenActive) { setZenEdgeArmed(false); return; }
    const t = setTimeout(() => setZenEdgeArmed(true), EDGE_ARM_DELAY_MS);
    return () => clearTimeout(t);
  }, [zenActive]);

  return { zenActive, zenEdgeArmed, exitZen };
}
