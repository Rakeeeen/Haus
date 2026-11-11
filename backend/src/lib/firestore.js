import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_PATH = path.join(__dirname, '..', '..', 'serviceAccountKey.json');

let db = null;

// What the bot has read, by where from, so "is the bot what is using the free reads?" has an answer: a line in the bot's log
// every hour (and the numbers since it started). A document the server sends is one billed read; a restart or a reconnect
// after the Mac slept sends a listener's documents again.
const reads = new Map();
const tally = (name, n = 1) => { reads.set(name, (reads.get(name) ?? 0) + n); };
const snapshotTally = (name, snap) => { tally(name, snap.docChanges().length); };
export function readsSoFar() {
  return Object.fromEntries([...reads.entries()].sort((a, b) => b[1] - a[1]));
}
setInterval(() => {
  const all = readsSoFar();
  const total = Object.values(all).reduce((a, b) => a + b, 0);
  console.log(`📊 Firestore reads by the bot since it started: ${total}`, JSON.stringify(all));
}, 60 * 60_000).unref();

/**
 * Lazily initializes the Admin SDK on first use instead of at import time, so
 * the rest of the bot (subscriptions, gold prices) still works fine even if
 * the dashboard-control feature isn't configured yet.
 */
function getDb() {
  if (db) return db;
  if (!fs.existsSync(KEY_PATH)) {
    throw new Error(
      'backend/serviceAccountKey.json is missing — download it from ' +
      'Firebase Console → Project Settings → Service Accounts → Generate new private key.'
    );
  }
  const serviceAccount = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
  db = getFirestore();
  return db;
}

export function dashboardConfigured() {
  return fs.existsSync(KEY_PATH);
}

// Mirrors useFirebaseSync's doc shape exactly — { value, updatedAt } — so a
// write from here shows up instantly in an already-open dashboard tab via its
// own onSnapshot listener, and a read here sees whatever the web app last wrote.
export async function getDashboardValue(key, fallback) {
  const snap = await getDb().collection('dashboard').doc(key).get();
  tally(`dashboard/${key}`);
  if (!snap.exists) return fallback;
  const data = snap.data();
  return data && data.value !== undefined ? data.value : fallback;
}

/** Calls `onChange` with the value now and every time it changes; returns a function that stops listening. */
export function watchDashboardValue(key, onChange) {
  return getDb().collection('dashboard').doc(key).onSnapshot(
    (snap) => (tally(`dashboard/${key} (watched)`), onChange(snap.exists && snap.data()?.value !== undefined ? snap.data().value : null)),
    (error) => console.error(`⚠️ Lost the Firestore listener for ${key}:`, error.message),
  );
}

export async function setDashboardValue(key, value) {
  await getDb().collection('dashboard').doc(key).set({
    value,
    updatedAt: new Date().toISOString(),
  });
}

/** One document of a collection (the data, or null). */
export async function getDocument(collection, id) {
  const snap = await getDb().collection(collection).doc(id).get();
  tally(collection);
  return snap.exists ? snap.data() : null;
}

export async function setDocument(collection, id, data) {
  await getDb().collection(collection).doc(id).set(data);
}

/**
 * Calls `onSnapshot` with every snapshot of a collection, the first one included (that one is what was already there);
 * returns a function that stops listening.
 */
export function watchCollection(collection, onSnapshot) {
  return getDb().collection(collection).onSnapshot(
    (snap) => { snapshotTally(`${collection} (watched)`, snap); onSnapshot(snap); },
    (error) => console.error(`⚠️ Lost the Firestore listener for ${collection}:`, error.message),
  );
}

/** A guest's own dashboard value (`users/{uid}/data/{key}` — the same `{ value }` shape as the owner's). */
export async function getUserValue(uid, key, fallback) {
  const snap = await getDb().collection('users').doc(uid).collection('data').doc(key).get();
  tally('users/{uid}/data');
  if (!snap.exists) return fallback;
  const data = snap.data();
  return data && data.value !== undefined ? data.value : fallback;
}

/** Every document of a collection, as `{ id, ...data }`. */
export async function listDocuments(collection) {
  const snap = await getDb().collection(collection).get();
  tally(collection, snap.size);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** The documents of a collection whose array field contains `value`. */
export async function listWhereContains(collection, field, value) {
  const snap = await getDb().collection(collection).where(field, 'array-contains', value).get();
  tally(collection, snap.size);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Like `watchCollection`, but only the documents whose `field` (an ISO time string, such as a task's `updatedAt`) is after
 * `since`: what changed since then, and every change after. A restart, or the Mac waking from sleep, then reads what changed —
 * not the whole collection again.
 */
export function watchChangesSince(collection, field, since, onSnapshot) {
  return getDb().collection(collection).where(field, '>', since).onSnapshot(
    (snap) => { snapshotTally(`${collection} (changes)`, snap); onSnapshot(snap); },
    (error) => console.error(`⚠️ Lost the Firestore listener for ${collection}:`, error.message),
  );
}

/** The documents of a collection whose `field` is one of `values`. */
export async function listWhereIn(collection, field, values) {
  const snap = await getDb().collection(collection).where(field, 'in', values).get();
  tally(collection, snap.size);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Like `watchCollection`, but only the documents whose `field` (a timestamp) is after `since` (a Date) — so a restart does not re-read what is old. */
export function watchCollectionAfter(collection, field, since, onSnapshot) {
  return getDb().collection(collection).where(field, '>', since).orderBy(field).onSnapshot(
    (snap) => { snapshotTally(`${collection} (watched)`, snap); onSnapshot(snap); },
    (error) => console.error(`⚠️ Lost the Firestore listener for ${collection}:`, error.message),
  );
}
