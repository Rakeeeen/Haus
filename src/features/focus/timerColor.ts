/** The colour the timer is drawn in: the session's own ink, the break's softer tone, or the overtime warning. */
export const timerColor = (mode: 'focus' | 'break', isOvertime: boolean): string =>
  isOvertime ? 'var(--pomo-overtime)' : mode === 'break' ? 'var(--pomo-break)' : 'var(--ink)';
