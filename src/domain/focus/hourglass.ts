/**
 * How much sand each chamber of Focus's hourglass holds, 0–1, from the session.
 *
 * `upper` and `lower` are the glass's own chambers, as drawn. A focus session runs the sand from
 * the upper chamber into the lower one. A break flips the glass, so the full lower chamber is now
 * on top and runs back. In overtime the session has run out: everything is in the lower chamber.
 */
export function hourglassSand(
  secondsLeft: number,
  totalSeconds: number,
  mode: 'focus' | 'break',
  overtime: boolean,
): { upper: number; lower: number } {
  if (overtime) return { upper: 0, lower: 1 };
  const passed = totalSeconds > 0 ? Math.min(1, Math.max(0, 1 - secondsLeft / totalSeconds)) : 0;
  return mode === 'focus'
    ? { upper: 1 - passed, lower: passed }
    : { upper: passed, lower: 1 - passed };
}
