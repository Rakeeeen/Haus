import { useCallback, useState } from 'react';

/**
 * State that survives a refresh: kept in this browser's localStorage under `key`. `valid` says whether what was stored
 * is still a value the screen understands (a choice may be renamed later); if not, `initial` is used. Without storage
 * (a private window) it is plain state.
 */
export function useStoredState<T>(key: string, initial: T, valid: (value: unknown) => value is T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) { const parsed: unknown = JSON.parse(raw); if (valid(parsed)) return parsed; }
    } catch { /* unreadable: use the default */ }
    return initial;
  });
  const set = useCallback((next: T) => {
    setValue(next);
    try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* no storage: it just won't be remembered */ }
  }, [key]);
  return [value, set];
}

/** A validator for "one of these strings". */
export const oneOf = <T extends string>(options: readonly T[]) => (value: unknown): value is T => typeof value === 'string' && (options as readonly string[]).includes(value);
/** A validator for "a list of those strings". */
export const manyOf = <T extends string>(options: readonly T[]) => (value: unknown): value is T[] => Array.isArray(value) && value.every(oneOf(options));
/** A validator for a "YYYY-MM-DD" day. */
export const isDay = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
