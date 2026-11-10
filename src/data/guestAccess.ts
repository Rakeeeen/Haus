import { useEffect, useState } from 'react';
import {
  collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, Timestamp, type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/data/firebase';
import { CODE_LIFETIME_MS, codeFromBytes } from '@/domain/access';

/**
 * Letting a guest in with a one-time code (domain/access.ts explains why, firestore.rules enforces it).
 * The guest asks, Hamed's screen turns the ask into a code only he can read, the guest types what Hamed tells
 * them, and the rules compare it to the stored one.
 */
const REQUESTS = 'guest_requests';
const CODES = 'guest_codes';
const APPROVALS = 'guest_approvals';

// ── The guest's side ────────────────────────────────────────────────────────────────────────

/**
 * Calls `onChange` with when this guest was let in (ms), or null if they haven't been; again whenever it
 * changes. A guest not yet let in can only read this one document, so that is all it ever says.
 */
export function watchGuestApproval(uid: string, onChange: (approvedAtMs: number | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, APPROVALS, uid),
    (snap) => {
      const at = snap.exists() ? (snap.data().approvedAt as Timestamp | null) : null;
      onChange(at ? at.toMillis() : null);
    },
    () => onChange(null),
  );
}

/** Tells Hamed's app who this guest is (their uid, name and photo), so he can put them on projects by name. */
export async function publishGuestProfile(uid: string, email: string, name: string | null, photoUrl: string | null): Promise<void> {
  await setDoc(doc(db, 'guest_profiles', uid), {
    email: email.toLowerCase(),
    ...(name ? { name } : {}),
    ...(photoUrl ? { photoUrl } : {}),
  });
}

/** Asks Hamed for a code: his screen shows it as soon as it sees this. */
export async function requestGuestCode(uid: string, email: string, name: string | null): Promise<void> {
  await setDoc(doc(db, REQUESTS, uid), {
    email: email.toLowerCase(),
    ...(name ? { name } : {}),
    requestedAt: serverTimestamp(),
  });
}

/** Tries the code the guest was given. Resolves if the rules accept it; rejects (permission denied) if not. */
export async function submitGuestCode(uid: string, code: string): Promise<void> {
  await setDoc(doc(db, APPROVALS, uid), { code, approvedAt: serverTimestamp() });
}

// ── The owner's side ────────────────────────────────────────────────────────────────────────

export interface GuestCode {
  uid: string;
  email: string;
  name?: string;
  code: string;
  expiresAt: number;
}

/**
 * For the owner's screen: answers every guest's ask with a fresh code, and returns the codes that are live
 * so they can be shown. `enabled` is false for everyone but the owner (nobody else may read these).
 */
export function useGuestCodes(enabled: boolean) {
  const [codes, setCodes] = useState<GuestCode[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const answering = new Set<string>();

    const stopRequests = onSnapshot(collection(db, REQUESTS), (snap) => {
      for (const request of snap.docs) {
        if (answering.has(request.id)) continue;
        answering.add(request.id);
        const { email, name } = request.data() as { email: string; name?: string };
        const code: GuestCode = {
          uid: request.id,
          email,
          ...(name ? { name } : {}),
          code: codeFromBytes(crypto.getRandomValues(new Uint8Array(32))),
          expiresAt: Date.now() + CODE_LIFETIME_MS,
        };
        setDoc(doc(db, CODES, request.id), code)
          .then(() => deleteDoc(request.ref))
          .catch((error) => console.warn('Could not answer a guest:', error))
          .finally(() => answering.delete(request.id));
      }
    });

    const stopCodes = onSnapshot(collection(db, CODES), (snap) => {
      setCodes(snap.docs.map((d) => d.data() as GuestCode));
    });

    return () => { stopRequests(); stopCodes(); setCodes([]); };
  }, [enabled]);

  return { codes, dismiss: (uid: string) => deleteDoc(doc(db, CODES, uid)) };
}
