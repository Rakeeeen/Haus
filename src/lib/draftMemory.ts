/**
 * Keeps what was being typed into a form for a little while, so closing it by accident (Escape, a click beside it)
 * doesn't lose it: it is saved in this browser's localStorage and offered again when the form is opened anew, until
 * it is older than `DRAFT_TTL_MS`.
 */
export const DRAFT_TTL_MS = 10 * 60 * 1000;

/** Whether something saved at `savedAt` (ms since 1970) is still fresh at `now`. */
export const isFresh = (savedAt: number, now: number = Date.now(), ttl: number = DRAFT_TTL_MS): boolean =>
  Number.isFinite(savedAt) && now - savedAt >= 0 && now - savedAt <= ttl;

export function saveDraft<T>(key: string, value: T, now: number = Date.now()): void {
  try { window.localStorage.setItem(key, JSON.stringify({ savedAt: now, value })); } catch { /* no storage: nothing is kept */ }
}

/** The saved draft if there is one and it is still fresh; an old one is removed. */
export function loadDraft<T>(key: string, now: number = Date.now()): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; value: T };
    if (isFresh(parsed.savedAt, now)) return parsed.value;
    window.localStorage.removeItem(key);
  } catch { /* unreadable: there is no draft */ }
  return null;
}

export function clearDraft(key: string): void {
  try { window.localStorage.removeItem(key); } catch { /* fine */ }
}
