/**
 * Who is using Haus. The owner is one fixed account; a guest is a Google account the owner has invited
 * (a document in /members, keyed by the lower-case email) and not switched off. firestore.rules enforces
 * the same two rules on the server; this only decides what the screen shows.
 */
export type Role = 'owner' | 'guest' | 'none';

export interface Invitation {
  email: string;
  active: boolean;
  addedAt?: string;
  name?: string;
}

/** Emails are matched case-insensitively, so an invitation's id is always the lower-case form. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (email: string): boolean => EMAIL.test(normalizeEmail(email));

export function roleOf(uid: string, ownerUid: string, invitation: Invitation | null): Role {
  if (uid === ownerUid) return 'owner';
  return invitation?.active ? 'guest' : 'none';
}

/** The name the header line greets someone by: the first word of their Google name. */
export function firstNameOf(displayName: string | null | undefined, email?: string | null): string {
  const fromName = displayName?.trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const fromEmail = email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim().split(/\s+/)[0];
  if (fromEmail) return fromEmail.charAt(0).toUpperCase() + fromEmail.slice(1);
  return 'Friend';
}

/** Who is looking at the screen, as the screens need to know it. */
export interface Viewer {
  role: Exclude<Role, 'none'>;
  firstName: string;
  /** Their Google photo, if they have one. */
  photoUrl: string | null;
}
