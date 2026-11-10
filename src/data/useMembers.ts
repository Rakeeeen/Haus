import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/data/firebase';
import { guestStatus, isValidEmail, normalizeEmail, type GuestStatus, type Invitation } from '@/domain/access';

const COL = 'members';

/** The invitation for this email, or null. Anyone signed in may read their own; nobody else's. */
export async function fetchInvitation(email: string | null | undefined): Promise<Invitation | null> {
  if (!email) return null;
  const snap = await getDoc(doc(db, COL, normalizeEmail(email)));
  return snap.exists() ? (snap.data() as Invitation) : null;
}

/** The owner's list of invited guests, kept live, with what changes it. Only the owner can read or write these. */
export function useGuests(enabled = true, withStatus = false) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [profiles, setProfiles] = useState<Array<{ uid: string; email: string; name?: string; photoUrl?: string }>>([]);
  const [approvals, setApprovals] = useState<Record<string, number>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) return;
    const stopInvitations = onSnapshot(
      collection(db, COL),
      (snap) => {
        setInvitations(snap.docs.map((d) => d.data() as Invitation).sort((a, b) => (a.addedAt ?? '').localeCompare(b.addedAt ?? '')));
        setError('');
      },
      (e) => setError(e.message),
    );
    // What each guest says about themself when they sign in: who their uid is, and their name and photo.
    const stopProfiles = onSnapshot(
      collection(db, 'guest_profiles'),
      (snap) => setProfiles(snap.docs.map((d) => ({ ...(d.data() as { email: string; name?: string; photoUrl?: string }), uid: d.id }))),
      () => { /* nothing to join yet */ },
    );
    // When each guest last typed a valid code (a document per uid): that is what "in" means. Only read when the list is on screen.
    const stopApprovals = !withStatus ? () => {} : onSnapshot(
      collection(db, 'guest_approvals'),
      (snap) => setApprovals(Object.fromEntries(snap.docs.flatMap((d) => {
        const at = d.data().approvedAt as { toMillis?: () => number } | null;
        return at?.toMillis ? [[d.id, at.toMillis()] as const] : [];
      }))),
      () => { /* nothing to join yet */ },
    );
    return () => { stopInvitations(); stopProfiles(); stopApprovals(); };
  }, [enabled, withStatus]);

  // An invited guest with what is known about them from their own sign-in.
  const guests = useMemo<Invitation[]>(() => invitations.map((invitation) => {
    const profile = profiles.find((p) => p.email === invitation.email);
    return profile ? { ...invitation, uid: profile.uid, name: invitation.name ?? profile.name, photoUrl: profile.photoUrl } : invitation;
  }), [invitations, profiles]);

  /** Where each guest stands (by email): invited, signed in, in, or off. */
  const statuses = useMemo<Record<string, GuestStatus>>(
    () => Object.fromEntries(guests.map((g) => [g.email, guestStatus(g, g.uid ? approvals[g.uid] ?? null : null, Date.now())])),
    [guests, approvals],
  );

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
    // Only what belongs on the invitation: what was joined in from their profile stays on the profile.
    await setDoc(doc(db, COL, guest.email), { email: guest.email, active, addedAt: guest.addedAt ?? new Date().toISOString(), ...(guest.name ? { name: guest.name } : {}) });
  }, []);

  const remove = useCallback(async (email: string) => {
    await deleteDoc(doc(db, COL, normalizeEmail(email)));
  }, []);

  return { guests, statuses, error, invite, setActive, remove };
}
