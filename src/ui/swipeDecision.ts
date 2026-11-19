/** What letting go of a swipe does. */
export type SwipeOutcome = 'delete' | 'back';

/**
 * Decides a released swipe from where it is and how the hand was moving — not from the position alone:
 *  - a slow, careful pull has to go past the line (`threshold`, px);
 *  - a quick flick only needs to have gone a fair way (30% of the line, at least 60 px), however short of the line it stopped;
 *  - a hand already coming back (`velocity` negative, px/ms, leftward positive) is a change of mind, so it cancels even past the line.
 */
export function decideSwipe({ pull, threshold, velocity }: { pull: number; threshold: number; velocity: number }): SwipeOutcome {
  if (velocity < -0.3) return 'back';
  if (pull >= threshold) return 'delete';
  if (velocity > 0.6 && pull >= Math.max(60, threshold * 0.3)) return 'delete';
  return 'back';
}

/** Recent movement of the hand: `(time ms, step px)` pairs, leftward positive. Velocity is taken over the last `windowMs` — short, so a hand that has turned back reads as turning back, not as the fast pull before it. */
export function velocityOf(samples: ReadonlyArray<readonly [number, number]>, now: number, windowMs = 60): number {
  const recent = samples.filter(([t]) => now - t <= windowMs);
  if (recent.length === 0) return 0;
  const span = Math.max(16, now - recent[0][0]);
  return recent.reduce((sum, [, step]) => sum + step, 0) / span;
}
