import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/** How many times a day's report is tried before giving up (a failing PDF or Discord shouldn't be retried forever). */
export const MAX_ATTEMPTS = 5;

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Whether today's report should go out now: Maghrib has come (this minute or any time since — a Mac that was asleep at
 * Maghrib sends it when it wakes, the same evening), it has not been sent today, and it hasn't failed too many times.
 * @param {{ now: Date, maghrib: string, state: { day: string, sent: boolean, attempts: number } | null }} input
 */
export function reportDue({ now, maghrib, state }) {
  const [hours, minutes] = (maghrib || '18:00').split(':').map(Number);
  const maghribToday = new Date(now);
  maghribToday.setHours(hours, minutes, 0, 0);
  if (now < maghribToday) return false;
  if (!state || state.day !== dayKey(now)) return true;
  return !state.sent && state.attempts < MAX_ATTEMPTS;
}

/** The next state after an attempt for `now`'s day. */
export function afterAttempt(state, now, sent) {
  const day = dayKey(now);
  const attempts = (state && state.day === day ? state.attempts : 0) + 1;
  return { day, sent, attempts };
}

/** Whether Maghrib has come today — checked before anything is read from Firestore, so the minute-by-minute check costs nothing all day. */
export function afterMaghrib(now, maghrib) {
  const [hours, minutes] = (maghrib || '18:00').split(':').map(Number);
  const at = new Date(now);
  at.setHours(hours, minutes, 0, 0);
  return now >= at;
}

/**
 * Which guests' reports go out now: Maghrib has come, and the guest has not been sent one today (nor failed too many times).
 * `state` is `{ day, sent: [uid…], attempts: { uid: n } }` for the day it was last written.
 * @param {{ now: Date, maghrib: string, state: { day: string, sent: string[], attempts: Record<string, number> } | null, uids: string[] }} input
 */
export function guestsDue({ now, maghrib, state, uids }) {
  const [hours, minutes] = (maghrib || '18:00').split(':').map(Number);
  const maghribToday = new Date(now);
  maghribToday.setHours(hours, minutes, 0, 0);
  if (now < maghribToday) return [];
  const today = state && state.day === dayKey(now) ? state : { sent: [], attempts: {} };
  return uids.filter((uid) => !today.sent.includes(uid) && (today.attempts[uid] ?? 0) < MAX_ATTEMPTS);
}

/** The state after trying `uid` today. */
export function afterGuestAttempt(state, now, uid, sent) {
  const day = dayKey(now);
  const base = state && state.day === day ? state : { day, sent: [], attempts: {} };
  return {
    day,
    sent: sent ? [...new Set([...base.sent, uid])] : base.sent,
    attempts: { ...base.attempts, [uid]: (base.attempts[uid] ?? 0) + 1 },
  };
}

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.report-state.json');

const GUEST_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.guest-report-state.json');
export function readGuestState() {
  try { return JSON.parse(fs.readFileSync(GUEST_FILE, 'utf8')); } catch { return null; }
}
export function writeGuestState(state) {
  fs.writeFileSync(GUEST_FILE, JSON.stringify(state));
}

export function readState() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return null; }
}
export function writeState(state) {
  fs.writeFileSync(FILE, JSON.stringify(state));
}
