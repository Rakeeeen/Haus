import { collection, doc, getDocsFromCache, onSnapshot, query, setDoc, where, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '@/data/firebase';
import { meterOpened, meterSnapshot } from '@/data/readMeter';
import { planSync, type SyncRecord } from '@/domain/sync';

/**
 * A whole collection, kept live, read from the server by its changes only (rules: domain/sync.ts). Hamed's own lists (all the
 * tasks, all the notes): a cold start shows the copy kept on this device at once and asks the server only for documents whose
 * `updatedAt` is newer than the newest one held, so it costs the few that changed instead of every document.
 *
 * A document that is deleted leaves a marker in `<collection>_deleted/{id}` ({ at }); that is how a device that only asks for
 * changes learns about it. If the markers can't be read (firestore.rules not yet deployed), or anything else goes wrong, it
 * falls back to listening to the whole collection, as before — never to a list that might be wrong.
 *
 * Every document passed to `onDocs` is the whole list as it stands.
 */
export function syncCollection(
  name: string,
  onDocs: (docs: QueryDocumentSnapshot[]) => void,
  onError: (error: Error) => void,
): () => void {
  const deletedName = `${name}_deleted`;
  const recordKey = `haus:sync:${name}`;
  const readRecord = (): SyncRecord | null => {
    try { return JSON.parse(localStorage.getItem(recordKey) ?? 'null') as SyncRecord | null; } catch { return null; }
  };
  const writeRecord = (record: SyncRecord) => { try { localStorage.setItem(recordKey, JSON.stringify(record)); } catch { /* best effort */ } };

  let stopped = false;
  let stops: Array<() => void> = [];
  const stopAll = () => { stops.forEach((stop) => stop()); stops = []; };

  /** Listens to the whole collection (the first time, once a week, and whenever the change-only way can't be trusted). */
  const listenToAll = () => {
    stopAll();
    meterOpened(name);
    stops.push(onSnapshot(collection(db, name), (snap) => {
      meterSnapshot(name, snap);
      // While this listener runs the whole list here is the server's, so each answer from the server is a full read.
      if (!snap.metadata?.fromCache) writeRecord({ fullAt: Date.now(), count: snap.docs.length });
      onDocs(snap.docs);
    }, onError));
  };

  (async () => {
    let held: QueryDocumentSnapshot[] = [];
    try {
      const [docs, deleted] = await Promise.all([
        getDocsFromCache(collection(db, name)),
        getDocsFromCache(collection(db, deletedName)).catch(() => null),
      ]);
      const gone = new Set(deleted?.docs.map((d) => d.id) ?? []);
      held = docs.docs.filter((d) => !gone.has(d.id));
    } catch { /* nothing kept here */ }
    if (stopped) return;

    const plan = planSync(readRecord(), held.map((d) => d.data() as { updatedAt?: unknown }));
    if (plan.mode === 'full') { listenToAll(); return; }

    // The copy kept here, shown at once; then only what changed since, and what was deleted since.
    const current = new Map(held.map((d) => [d.id, d]));
    // In the order a listener on the whole collection gives them (by id), so nothing on screen moves.
    const inOrder = () => [...current.values()].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
    onDocs(inOrder());
    const changed = (snap: { metadata?: { fromCache: boolean } }) => {
      onDocs(inOrder());
      if (!snap.metadata?.fromCache) {
        const record = readRecord();
        if (record) writeRecord({ ...record, count: current.size });
      }
    };
    meterOpened(`${name} (changes)`);
    stops.push(onSnapshot(query(collection(db, name), where('updatedAt', '>', plan.since)), (snap) => {
      meterSnapshot(name, snap);
      for (const change of snap.docChanges()) {
        // Leaving this list can only mean the document was deleted: `updatedAt` never goes back.
        if (change.type === 'removed') current.delete(change.doc.id);
        else current.set(change.doc.id, change.doc);
      }
      changed(snap);
    }, (error) => { if (!stopped) { console.warn(`Reading ${name} by its changes failed, reading all of it:`, error.message); listenToAll(); } }));
    meterOpened(deletedName);
    stops.push(onSnapshot(query(collection(db, deletedName), where('at', '>', plan.since)), (snap) => {
      meterSnapshot(deletedName, snap);
      let any = false;
      for (const d of snap.docs) if (current.delete(d.id)) any = true;
      if (any || !snap.metadata?.fromCache) changed(snap);
    }, (error) => { if (!stopped) { console.warn(`Could not read what was deleted from ${name}, reading all of it:`, error.message); listenToAll(); } }));
  })();

  return () => { stopped = true; stopAll(); };
}

/** Leaves the marker a device reading `name` by its changes needs to learn `id` is gone. Best effort: the deletion itself is done. */
export function markDeleted(name: string, id: string): Promise<void> {
  return setDoc(doc(db, `${name}_deleted`, id), { at: new Date().toISOString() })
    .catch((error) => console.warn(`Could not note that ${name}/${id} was deleted:`, error));
}
