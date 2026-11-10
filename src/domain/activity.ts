import { statusLabel } from '@/domain/work/tasks';
import type { TaskStatus } from '@/domain/work/types';

/**
 * What a guest does in Haus, kept as a log Hamed can read (and the bot reports to Discord). Only a guest's own actions
 * are written; firestore.rules lets an approved guest add an entry about themself and nobody else's, and only Hamed read it.
 */
export type ActivityType = 'entered' | 'task_created' | 'task_status' | 'task_deleted' | 'comment';

export const ACTIVITY_TYPES: readonly ActivityType[] = ['entered', 'task_created', 'task_status', 'task_deleted', 'comment'];

export interface ActivityEntry {
  id: string;
  /** The guest's uid. */
  uid: string;
  name: string;
  type: ActivityType;
  /** A short sentence about what they did. */
  text: string;
  taskId?: string;
  /** When it happened, ISO. */
  at: string;
}

/** The longest sentence an entry keeps (firestore.rules refuses a longer one). */
export const MAX_ACTIVITY_TEXT = 240;
const clip = (text: string, max = 80) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const titled = (title: string) => `“${clip(title.trim() || 'Untitled')}”`;

export const enteredText = (cameWithCode: boolean) => (cameWithCode ? 'Entered the code and came in' : 'Opened Haus');
export const createdText = (title: string) => `Added the task ${titled(title)}`;
export const deletedText = (title: string) => `Deleted the task ${titled(title)}`;
export const commentedText = (title: string) => `Commented on ${titled(title)}`;
export const statusChangeText = (title: string, from: TaskStatus, to: TaskStatus) =>
  `Moved ${titled(title)} from ${statusLabel(from)} to ${statusLabel(to)}`;

/** One person's entries, or everyone's (`uid` null), newest first. */
export function entriesOf(entries: readonly ActivityEntry[], uid: string | null): ActivityEntry[] {
  return entries.filter((e) => !uid || e.uid === uid).sort((a, b) => b.at.localeCompare(a.at));
}

/** The entries grouped under their day (the device's calendar day), newest day first. */
export function byDay(entries: readonly ActivityEntry[]): Array<{ day: string; entries: ActivityEntry[] }> {
  const days = new Map<string, ActivityEntry[]>();
  for (const e of entries) {
    const d = new Date(e.at);
    const pad = (n: number) => String(n).padStart(2, '0');
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    days.set(key, [...(days.get(key) ?? []), e]);
  }
  return [...days].map(([day, list]) => ({ day, entries: list }));
}
