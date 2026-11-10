import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from '@/data/firebase';

/** Who is signed in (Firebase Auth's user). Everything outside `data/` reaches sign-in through this file, never `firebase/auth`. */
export type AuthUser = User;

export const signInWithGoogle = (): Promise<unknown> => signInWithPopup(auth, googleProvider);
export const signOutUser = (): Promise<void> => signOut(auth);

/** Calls `listener` with the signed-in user (or null) now and whenever it changes; returns how to stop listening. */
export const watchAuthUser = (listener: (user: AuthUser | null) => void | Promise<void>): (() => void) => onAuthStateChanged(auth, listener);
