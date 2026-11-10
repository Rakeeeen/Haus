import { useCallback, useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/data/firebase';
import { isValidEmail, normalizeEmail, type Invitation } from '@/domain/access';

const COL = 'members';

/** The invitation for this email, or null. Anyone signed in may read their own; nobody else's. */
export async function fetchInvitation(email: string | null | undefined): Promise<Invitation | null> {
  if (!email) return null;
  const snap = await getDoc(doc(db, COL, normalizeEmail(email)));
  return snap.exists() ? (snap.data() as Invitation) : null;
}

/** The owner's list of invited guests, kept live, with what changes it. Only the owner can read or write these. */
export function useGuests(enabled = true) {
  const [guests, setGuests] = useState<Invitation[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      collection(db, COL),
      (snap) => {
        setGuests(snap.docs.map((d) => d.data() as Invitation).sort((a, b) => (a.addedAt ?? '').localeCompare(b.addedAt ?? '')));
        setError('');
      },
      (e) => setError(e.message),
    );
  }, [enabled]);

  const invite = useCallback(async (email: string, name?: string) => {
    if (!isValidEmail(email)) throw new Error('That is not an email address');
    const id = normalizeEmail(email);
    // Merged, so inviting someone again keeps what is already known about them (their uid and photo).
    await setDoc(doc(db, COL, id), {
      email: id,
      active: true,
      addedAt: new Date().toISOString(),
      ...(name?.trim() ? { name: name.trim() } : {}),
    }, { merge: true });
  }, []);

  const setActive = useCallback(async (guest: Invitation, active: boolean) => {
    await setDoc(doc(db, COL, guest.email), { ...guest, active });
  }, []);

  const remove = useCallback(async (email: string) => {
    await deleteDoc(doc(db, COL, normalizeEmail(email)));
  }, []);

  return { guests, error, invite, setActive, remove };
}
