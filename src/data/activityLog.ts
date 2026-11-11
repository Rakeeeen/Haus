import { useEffect, useState } from 'react';
import { addDoc, collection, getDocsFromCache, limit, onSnapshot, orderBy, query, serverTimestamp, where, type QueryDocumentSnapshot, type Timestamp } from 'firebase/firestore';
import { db } from '@/data/firebase';
import { metered } from '@/data/readMeter';
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

/**
 * Hamed's view: the latest entries, newest first, kept live. Only the owner can read them.
 *
 * The log only ever grows (nothing edits or deletes a line), so a visit after the first shows the lines kept on this device at
 * once and asks the server only for the ones newer than the newest it holds. Measured on the local emulator: every visit to the
 * Activity page read all 300 lines again; now a visit reads the lines written since the last one.
 */
export function useActivityLog(enabled: boolean, max = 300) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const toEntry = (d: QueryDocumentSnapshot): ActivityEntry => {
      const data = d.data({ serverTimestamps: 'estimate' }) as Omit<ActivityEntry, 'id' | 'at'> & { at: Timestamp };
      return { ...data, id: d.id, at: data.at.toDate().toISOString() };
    };
    const latest = query(collection(db, LOG), orderBy('at', 'desc'), limit(max));
    const failed = (error: Error) => { console.warn('Could not read the log:', error.message); setReady(true); };
    let stopped = false;
    let stop = () => {};
    (async () => {
      let held: QueryDocumentSnapshot[] = [];
      try { held = (await getDocsFromCache(latest)).docs; } catch { /* nothing kept here */ }
      if (stopped) return;
      if (held.length === 0) {
        stop = onSnapshot(latest, metered(LOG, (snap) => { setEntries(snap.docs.map(toEntry)); setReady(true); }), failed);
        return;
      }
      const kept = held.map(toEntry);
      setEntries(kept);
      setReady(true);
      const newest = held[0].data({ serverTimestamps: 'estimate' }).at as Timestamp;
      stop = onSnapshot(query(collection(db, LOG), where('at', '>', newest), orderBy('at', 'desc')), metered(`${LOG} (newer)`, (snap) => {
        const fresh = snap.docs.map(toEntry);
        const seen = new Set(fresh.map((e) => e.id));
        setEntries([...fresh, ...kept.filter((e) => !seen.has(e.id))].slice(0, max));
      }), failed);
    })();
    return () => { stopped = true; stop(); };
  }, [enabled, max]);
  return { entries, ready };
}
