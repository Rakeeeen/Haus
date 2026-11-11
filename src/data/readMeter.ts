import type { DocumentSnapshot, QuerySnapshot } from 'firebase/firestore';

/**
 * Counts what this browser tab asks Firestore for, so "where are the reads going?" has an answer in numbers. In the browser
 * console on the running site, `hausReads()` prints, per document or list:
 *  - `opened`: listeners opened (each opening reads what it covers);
 *  - `joined`: parts of the app that asked for it (what it would have cost before listeners were shared);
 *  - `updates`: answers the app received.
 * and, per collection, `sent`: the documents the server actually sent — each one a billed read. `sent` is counted on the
 * network, the only place that sees every one (a document sent again unchanged never reaches the app's code), so it is off
 * unless asked for: `localStorage.hausMeter = '1'`, then reload. `hausReads.reset()` starts again. Nothing is stored or sent.
 */

interface Row { opened: number; joined: number; updates: number }
const rows = new Map<string, Row>();
const sent = new Map<string, number>();
const row = (name: string): Row => {
  let r = rows.get(name);
  if (!r) { r = { opened: 0, joined: 0, updates: 0 }; rows.set(name, r); }
  return r;
};

/** A listener was opened on `name`. */
export const meterOpened = (name: string) => { row(name).opened += 1; };
/** A part of the app asked for `name` (it may have been given an already-open listener). */
export const meterJoined = (name: string) => { row(name).joined += 1; };
/** The app received an answer for `name`. */
export const meterSnapshot = (name: string, _snap?: DocumentSnapshot | QuerySnapshot) => { row(name).updates += 1; };

/** `onSnapshot`'s handler for one document, counted first. */
export const meteredDoc = (name: string, handler: (snap: DocumentSnapshot) => void) =>
  (snap: DocumentSnapshot) => { meterSnapshot(name); handler(snap); };

/** `onSnapshot`'s handler for a query or a collection, counted first. */
export const metered = (name: string, handler: (snap: QuerySnapshot) => void) =>
  (snap: QuerySnapshot) => { meterSnapshot(name); handler(snap); };

/** Counts, in a chunk of what Firestore sent, the documents it carries, by the collection they are in. */
export function countSent(chunk: string, into: Map<string, number> = sent): void {
  for (const m of chunk.matchAll(/"(?:documentChange":\{"document|found)":\{"name":"projects\/[^/]+\/databases\/\(default\)\/documents\/([^"]+)"/g)) {
    const path = m[1].split('/');
    const collection = path.slice(0, -1).join('/');
    into.set(collection, (into.get(collection) ?? 0) + 1);
  }
}

/** Reads, without changing them, the streamed answers Firestore's long polling receives (it runs over fetch). */
function watchNetwork() {
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const answer = original(input, init);
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (/firestore\.googleapis\.com|google\.firestore\.v1/.test(url)) {
      answer.then((res) => {
        const reader = res.clone().body?.getReader();
        if (!reader) return;
        const decoder = new TextDecoder();
        let carry = '';
        const pump = (): Promise<void> => reader.read().then(({ done, value }) => {
          if (done) { countSent(carry); return; }
          const text = carry + decoder.decode(value, { stream: true });
          // A document's name may be cut between two chunks: what follows the last complete one is kept for the next.
          const cut = text.lastIndexOf('{"name":');
          countSent(cut > 0 ? text.slice(0, cut) : '');
          carry = cut > 0 ? text.slice(cut) : text;
          return pump();
        }, () => {});
        void pump();
      }, () => {});
    }
    return answer;
  };
}

type HausReads = { (): { listeners: Record<string, Row>; sent: Record<string, number> | string }; reset: () => void };

function report() {
  const listeners = Object.fromEntries([...rows.entries()].sort((a, b) => b[1].opened - a[1].opened));
  console.table(listeners);
  const counting = typeof localStorage !== 'undefined' && localStorage.getItem('hausMeter') === '1';
  const bySent = Object.fromEntries([...sent.entries()].sort((a, b) => b[1] - a[1]));
  if (counting) {
    console.table({ ...bySent, ALL: [...sent.values()].reduce((a, b) => a + b, 0) });
  } else {
    console.log("Documents sent (billed reads) are counted on the network: localStorage.hausMeter = '1', then reload.");
  }
  return { listeners, sent: counting ? bySent : 'off' };
}

if (typeof window !== 'undefined') {
  const hausReads: HausReads = Object.assign(report, { reset: () => { rows.clear(); sent.clear(); } });
  (window as unknown as { hausReads: HausReads }).hausReads = hausReads;
  try {
    if (localStorage.getItem('hausMeter') === '1' && typeof window.fetch === 'function') watchNetwork();
  } catch { /* no storage: no network counting */ }
}
