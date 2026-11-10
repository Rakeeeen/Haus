import { useEffect, useState } from 'react';
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp, type Timestamp } from 'firebase/firestore';
import { db } from '@/data/firebase';
import { MAX_ACTIVITY_TEXT, type ActivityEntry, type ActivityType } from '@/domain/activity';

const LOG = 'activity_log';

/**
 * Writes one line about what a guest just did. Best effort: a failed log never gets in the way of what they were doing.
 * (firestore.rules lets only an approved guest write one about themself; the bot reads these and tells Discord.)
 */
export async function logActivity(entry: { uid: string; name: string; type: ActivityType; text: string; taskId?: string }): Promise<void> {
  try {
    await addDoc(collection(db, LOG), {
      uid: entry.uid, name: entry.name, type: entry.type, text: entry.text.slice(0, MAX_ACTIVITY_TEXT),
      ...(entry.taskId ? { taskId: entry.taskId } : {}), at: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Could not log what happened:', error);
  }
}

/** Hamed's view: the latest entries, newest first, kept live. Only the owner can read them. */
export function useActivityLog(enabled: boolean, max = 300) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      query(collection(db, LOG), orderBy('at', 'desc'), limit(max)),
      (snap) => {
        setEntries(snap.docs.map((d) => {
          const data = d.data({ serverTimestamps: 'estimate' }) as Omit<ActivityEntry, 'id' | 'at'> & { at: Timestamp };
          return { ...data, id: d.id, at: data.at.toDate().toISOString() };
        }));
        setReady(true);
      },
      (error) => { console.warn('Could not read the log:', error.message); setReady(true); },
    );
  }, [enabled, max]);
  return { entries, ready };
}
