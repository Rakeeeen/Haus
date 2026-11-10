/**
 * What a mouse wheel should do over a row that scrolls sideways (its scrollbar is hidden, and a plain wheel only turns up
 * and down): the new `scrollLeft` to scroll the row sideways by the wheel's vertical turn, or null to leave the wheel alone.
 * It is left alone when the row doesn't overflow, when the wheel already turns sideways (a trackpad, or Shift held), and
 * when the row is already at the end the wheel is heading to — so the page keeps scrolling instead of getting stuck on it.
 */
export function wheelToScrollLeft(
  wheel: { deltaX: number; deltaY: number; shiftKey: boolean },
  row: { scrollLeft: number; scrollWidth: number; clientWidth: number },
): number | null {
  const max = row.scrollWidth - row.clientWidth;
  if (max <= 0) return null;
  if (wheel.shiftKey || Math.abs(wheel.deltaX) >= Math.abs(wheel.deltaY) || wheel.deltaY === 0) return null;
  const next = Math.min(max, Math.max(0, row.scrollLeft + wheel.deltaY));
  return next === row.scrollLeft ? null : next;
}
