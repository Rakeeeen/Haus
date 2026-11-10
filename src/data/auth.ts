import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { clearIndexedDbPersistence, terminate } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/data/firebase';

/** Who is signed in (Firebase Auth's user). Everything outside `data/` reaches sign-in through this file, never `firebase/auth`. */
export type AuthUser = User;

export const signInWithGoogle = (): Promise<unknown> => signInWithPopup(auth, googleProvider);
/**
 * Signs out, wipes the copy of the data kept on this device (it belongs to whoever just left — the next person on this browser
 * must not be shown it) and reloads, so Firestore starts again clean.
 */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch (error) {
    console.warn('Could not clear the data kept on this device:', error);
  }
  window.location.reload();
}

/** Calls `listener` with the signed-in user (or null) now and whenever it changes; returns how to stop listening. */
export const watchAuthUser = (listener: (user: AuthUser | null) => void | Promise<void>): (() => void) => onAuthStateChanged(auth, listener);
