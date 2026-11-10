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
  /** Their Firebase uid and Google photo — known once they have signed in and asked for a code. */
  uid?: string;
  photoUrl?: string;
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

// ── Letting a guest in with a code ──────────────────────────────────────────────────────────────
// A guest has no fingerprint here (that is Hamed's). Instead, when they sign in, Hamed's system shows him
// a one-time code, he gives it to them, and they type it. firestore.rules checks the code itself, and
// keeps a guest out of everything until they have entered one — the same two numbers are written there.

/** How long a code can be typed in. */
export const CODE_LIFETIME_MS = 5 * 60 * 1000;
/** How long a guest stays in after entering a code, before they need a new one. */
export const GUEST_APPROVAL_DAYS = 30;
/** Eight digits: guessing one inside its five minutes is hopeless. */
export const CODE_LENGTH = 8;

/** A code from random bytes (the caller supplies crypto-strong ones; at least 4× CODE_LENGTH are plenty). */
export function codeFromBytes(bytes: ArrayLike<number>): string {
  let code = '';
  // Bytes 250–255 would favour the low digits when reduced to 0–9, so they are skipped.
  for (let i = 0; i < bytes.length && code.length < CODE_LENGTH; i++) {
    if (bytes[i] < 250) code += String(bytes[i] % 10);
  }
  if (code.length < CODE_LENGTH) throw new Error('Not enough random bytes for a code');
  return code;
}

/** Arabic-Indic (٠–٩), Persian (۰–۹) and full-width (０–９) digits as the plain 0–9 a keyboard in any language can type. */
const toLatinDigits = (input: string): string =>
  input.replace(/[\u0660-\u0669\u06F0-\u06F9\uFF10-\uFF19]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0xff10 ? code - 0xff10 : code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });

/**
 * What someone typed, reduced to the code's digits ("4829 1037" → "48291037"), whatever language their keyboard
 * is in: "٤٨٢٩ ١٠٣٧" is the same code.
 */
export const normalizeCode = (input: string): string => toLatinDigits(input).replace(/\D/g, '').slice(0, CODE_LENGTH);

/** A code as shown, in two groups: "48291037" → "4829 1037". */
export const formatCode = (code: string): string => code.replace(/^(\d{4})(\d+)$/, '$1 $2');

export const isCompleteCode = (input: string): boolean => normalizeCode(input).length === CODE_LENGTH;

/** Whether a guest approved at `approvedAtMs` is still in at `nowMs`. */
export function isApprovalValid(approvedAtMs: number, nowMs: number): boolean {
  return nowMs < approvedAtMs + GUEST_APPROVAL_DAYS * 24 * 60 * 60 * 1000;
}

/** Whole seconds left on a code (never below 0). */
export const secondsLeft = (expiresAtMs: number, nowMs: number): number =>
  Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000));
