/**
 * Reading a list from Firestore by its changes only ("delta sync"), the rules: whether this device's own copy can be trusted,
 * and from when to ask the server for what changed.
 *
 * Why: a listener on a whole collection is billed one read per document every time it starts cold — a new session after half
 * an hour away, a reload of a device that slept, a second device. Hamed's tasks are the biggest list he has, so every cold start
 * read all of them, whether anything had changed or not. With the copy Firestore keeps on the device, a cold start can show
 * that copy at once (free) and ask the server only for documents whose `updatedAt` is newer than the newest one it already has.
 */

/** What was true the last time this device read the whole list from the server. */
export interface SyncRecord {
  /** When (ms) the whole list was last read from the server. */
  fullAt: number;
  /** How many documents the list had then (or after the last change since). */
  count: number;
}

/**
 * How far before the newest change this device holds it asks again. `updatedAt` is written by each device's own clock, so a
 * change made on a device whose clock is a little behind could carry an older time than one already seen; two hours covers any
 * clock that is merely off, and costs only the documents changed in those two hours. (A change that is later than that — made
 * offline for hours, or on a clock that is badly wrong — is put right by the weekly full read.)
 */
export const SYNC_MARGIN_MS = 2 * 3_600_000;

/** The whole list is read again at least this often, whatever happens: anything a change-only read could miss is put right. */
export const FULL_SYNC_EVERY_MS = 7 * 24 * 3_600_000;

export type SyncPlan = { mode: 'full'; reason: string } | { mode: 'changes'; since: string };

/**
 * Whether to read the whole list (`full`) or only what changed since a time (`changes`), from the record of the last full read
 * and the documents this device holds (those known to be deleted already taken out).
 */
export function planSync(record: SyncRecord | null, held: ReadonlyArray<{ updatedAt?: unknown }>, now: Date = new Date()): SyncPlan {
  if (!record) return { mode: 'full', reason: 'never read here' };
  if (held.length === 0) return { mode: 'full', reason: 'nothing kept on this device' };
  if (now.getTime() - record.fullAt > FULL_SYNC_EVERY_MS) return { mode: 'full', reason: 'a week since the last full read' };
  // Fewer than there were: the device's copy has lost some (cleared, or trimmed by the browser). Only a full read is safe.
  if (held.length < record.count) return { mode: 'full', reason: 'the copy here is missing documents' };
  let newest = '';
  for (const { updatedAt } of held) if (typeof updatedAt === 'string' && updatedAt > newest) newest = updatedAt;
  const at = Date.parse(newest);
  if (!newest || Number.isNaN(at)) return { mode: 'full', reason: 'no change times kept' };
  return { mode: 'changes', since: new Date(at - SYNC_MARGIN_MS).toISOString() };
}
