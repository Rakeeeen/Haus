import { onSnapshot, type DocumentReference, type DocumentSnapshot, type Query, type QuerySnapshot } from 'firebase/firestore';
import { meterJoined, meterOpened, meterSnapshot } from '@/data/readMeter';

/**
 * One live Firestore listener per document (or per list), however many components ask for it. `useFirebaseSync` is called by
 * several parts of the app for the same value (the water count by Home, Water and the daily reset; the focus numbers by the
 * timer and the reset…), and the guests' list by Home, Projects, Activity and the task editor: each used to open its own
 * listener, and opening a listener is a billed read of everything it covers. Now they share one, and a part that arrives later
 * is handed the last answer at once.
 *
 * The listener outlives its last user by `LINGER_MS`. Going to another page and back is then free: the listener never closed,
 * so nothing is sent again (a closed one sends everything again when it reopens). While it lingers, only real changes cost a
 * read — the same changes reopening it would have read anyway. Measured on the local emulator: Home → Finance → Home read 19
 * documents again on the way back, and every visit to a Work page re-read the guests' list.
 */

type Snap = DocumentSnapshot | QuerySnapshot;
interface Subscriber<S> { onSnap: (snap: S) => void; onError: (error: Error) => void }
interface Entry<S> {
  subscribers: Set<Subscriber<S>>;
  stop: () => void;
  /** The newest thing the server said, to hand to whoever joins later. */
  last: { snap: S } | { error: Error } | null;
  closeTimer: ReturnType<typeof setTimeout> | null;
}

const LINGER_MS = 10 * 60_000;
const entries = new Map<string, Entry<Snap>>();

function share<S extends Snap>(key: string, open: (onSnap: (snap: S) => void, onError: (error: Error) => void) => () => void,
  onSnap: (snap: S) => void, onError: (error: Error) => void): () => void {
  let entry = entries.get(key) as Entry<S> | undefined;
  if (!entry) {
    const created: Entry<S> = { subscribers: new Set(), stop: () => {}, last: null, closeTimer: null };
    meterOpened(key);
    created.stop = open(
      (snap) => { meterSnapshot(key, snap); created.last = { snap }; [...created.subscribers].forEach((s) => s.onSnap(snap)); },
      (error) => { created.last = { error }; [...created.subscribers].forEach((s) => s.onError(error)); },
    );
    entries.set(key, created as unknown as Entry<Snap>);
    entry = created;
  }
  if (entry.closeTimer) { clearTimeout(entry.closeTimer); entry.closeTimer = null; }
  meterJoined(key);

  const subscriber: Subscriber<S> = { onSnap, onError };
  entry.subscribers.add(subscriber);
  if (entry.last) {
    if ('snap' in entry.last) onSnap(entry.last.snap);
    else onError(entry.last.error);
  }

  const joined = entry;
  return () => {
    joined.subscribers.delete(subscriber);
    if (joined.subscribers.size > 0 || joined.closeTimer) return;
    joined.closeTimer = setTimeout(() => {
      if (joined.subscribers.size > 0) return;
      joined.stop();
      if (entries.get(key) === (joined as unknown as Entry<Snap>)) entries.delete(key);
    }, LINGER_MS);
  };
}

/** Calls `onSnap` with the document now and whenever it changes; returns how to stop. */
export function watchDoc(ref: DocumentReference, onSnap: (snap: DocumentSnapshot) => void, onError: (error: Error) => void): () => void {
  return share<DocumentSnapshot>(ref.path, (next, fail) => onSnapshot(ref, next, fail), onSnap, onError);
}

/**
 * The same for a list. `name` says which list it is (the same name must always mean the same query: the collection, or the
 * collection plus what it is filtered by).
 */
export function watchQuery(name: string, q: Query, onSnap: (snap: QuerySnapshot) => void, onError: (error: Error) => void): () => void {
  return share<QuerySnapshot>(`query:${name}`, (next, fail) => onSnapshot(q, next, fail), onSnap, onError);
}

/** Closes every listener at once: when the person signs out, and in tests (each case starts from nothing). */
export function stopAllSharedDocs(): void {
  entries.forEach((entry) => { if (entry.closeTimer) clearTimeout(entry.closeTimer); entry.stop(); });
  entries.clear();
}
