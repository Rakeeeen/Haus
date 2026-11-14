import { doc, type DocumentReference } from 'firebase/firestore';
import { db } from '@/data/firebase';
import type { DayRole } from '@/domain/dayRules';

/**
 * Where the signed-in person's dashboard values live. The owner's stay exactly where they always were
 * (dashboard/{key}, which the bot reads too); a guest's go in their own area (users/{uid}/data/{key}),
 * and their copy in localStorage is prefixed so two people on one browser never share a value.
 * `none` is signed out or not allowed in: nothing is read from or written to Firestore.
 *
 * AuthProvider sets this before anything that reads values is shown, and shows those parts again
 * (a new `key`) whenever the person changes.
 */
export type DataScope = { kind: 'owner' } | { kind: 'guest'; uid: string } | { kind: 'none' };

let scope: DataScope = { kind: 'none' };

export function setDataScope(next: DataScope) {
  scope = next;
}

/** Whose day rules apply: a guest's day closes at midnight, Hamed's follows the prayer times (domain/dayRules.ts). */
export function currentDayRole(): DayRole {
  return scope.kind === 'guest' ? 'guest' : 'owner';
}

/** The Firestore document holding `key`, or null when this scope has no Firestore access. */
export function scopedDoc(key: string): DocumentReference | null {
  if (scope.kind === 'owner') return doc(db, 'dashboard', key);
  if (scope.kind === 'guest') return doc(db, 'users', scope.uid, 'data', key);
  return null;
}

/** The localStorage key for `key` in this scope. The owner's are the plain names, as before. */
export function storageKey(key: string): string {
  return scope.kind === 'guest' ? `guest:${scope.uid}:${key}` : key;
}

/** The value last stored locally for `key` (read straight from localStorage, which is never behind a render). */
export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/** Stores `value` for `key` locally, stamped, the same way a synced value is. */
export function writeStored(key: string, value: unknown, at: string = new Date().toISOString()) {
  window.localStorage.setItem(storageKey(key), JSON.stringify(value));
  window.localStorage.setItem(`${storageKey(key)}_updatedAt`, at);
}
