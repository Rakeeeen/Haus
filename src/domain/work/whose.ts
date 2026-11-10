/**
 * Whose tasks a screen shows: the viewer's own ("mine"), everything they can see ("all"), or one particular person's
 * (that person's key — a guest's uid, or `OWNER_KEY` for Hamed).
 */
export const WHOSE_MINE = 'mine';
export const WHOSE_ALL = 'all';

/** The person to filter tasks by (`filterTasks({ forMe })`), or undefined for no filter. `me` is the viewer's own key. */
export function forMeOf(whose: string, me: string): string | undefined {
  if (whose === WHOSE_ALL) return undefined;
  return whose === WHOSE_MINE ? me : whose;
}

/** "Mine", "Everyone", then each person the viewer can pick by name (never the viewer twice). */
export function whoseOptions(people: ReadonlyArray<{ key: string; name: string }>, me: string): Array<{ value: string; label: string }> {
  return [
    { value: WHOSE_MINE, label: 'Mine' },
    { value: WHOSE_ALL, label: 'Everyone' },
    ...people.filter((p) => p.key !== me).map((p) => ({ value: p.key, label: p.name })),
  ];
}

/** A remembered choice that is no longer on offer (that guest was removed) falls back to "mine". */
export const validWhose = (whose: string, options: ReadonlyArray<{ value: string }>): string =>
  options.some((o) => o.value === whose) ? whose : WHOSE_MINE;
