import { readFileSync } from 'fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, Timestamp, where } from 'firebase/firestore';

const OWNER = 'bPw2qdHsBJOwSmrNKMRtlZghfiU2';
const google = { email_verified: true, firebase: { sign_in_provider: 'google.com' } };
const SARA = 'sara'; // wrote the notes, is on the project
const OMAR = 'omar'; // on the project too
const LINA = 'lina'; // not on the project

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'haus-rules-test', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    for (const uid of [SARA, OMAR, LINA]) {
      await setDoc(doc(db, 'members', `${uid}@example.com`), { active: true });
      await setDoc(doc(db, 'guest_approvals', uid), { code: 'x', approvedAt: Timestamp.now() });
    }
    await setDoc(doc(db, 'work_projects', 'p1'), { name: 'Brand', memberUids: [SARA, OMAR], adminUids: [], guestsSeeAll: false });
    await setDoc(doc(db, 'work_notes', 'sara-note'), { title: 'S', markdown: 'm', projectId: 'p1', authorUid: SARA, authorName: 'Sara', viewerUids: [SARA, OMAR], editorUids: [], createdAt: 'a', updatedAt: 'a' });
    await setDoc(doc(db, 'work_notes', 'sara-private'), { title: 'P', markdown: 'm', projectId: null, authorUid: SARA, authorName: 'Sara', viewerUids: [SARA], editorUids: [], createdAt: 'a', updatedAt: 'a' });
    await setDoc(doc(db, 'work_notes', 'hamed-note'), { title: 'H', markdown: 'm', projectId: 'p1', viewerUids: [SARA, OMAR], editorUids: [], createdAt: 'a', updatedAt: 'a' });
    await setDoc(doc(db, 'work_notes', 'old-note'), { title: 'Old', markdown: 'm', projectId: 'p1', createdAt: 'a', updatedAt: 'a' }); // from before sharing
  });
});

const guest = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@example.com`, ...google }).firestore();
const owner = () => env.authenticatedContext(OWNER, { email: 'owner@example.com', ...google }).firestore();
const mine = (uid: string) => query(collection(guest(uid), 'work_notes'), where('viewerUids', 'array-contains', uid));
const newNote = (uid: string, over: Record<string, unknown> = {}) => ({
  title: 'T', markdown: 'm', projectId: 'p1', authorUid: uid, authorName: uid, viewerUids: [SARA, OMAR], editorUids: [], createdAt: 'a', updatedAt: 'b', ...over,
});

describe('reading notes', () => {
  it('shows a guest the notes of their projects and their own private ones, not others\'', async () => {
    await assertSucceeds(getDoc(doc(guest(OMAR), 'work_notes', 'sara-note')));
    await assertSucceeds(getDoc(doc(guest(OMAR), 'work_notes', 'hamed-note')));
    await assertFails(getDoc(doc(guest(OMAR), 'work_notes', 'sara-private')));
    await assertFails(getDoc(doc(guest(LINA), 'work_notes', 'sara-note')));
    await assertSucceeds(getDoc(doc(guest(SARA), 'work_notes', 'sara-private')));
  });
  it('keeps a note from before sharing to Hamed until it is shared', async () => {
    await assertFails(getDoc(doc(guest(SARA), 'work_notes', 'old-note')));
    await assertSucceeds(getDoc(doc(owner(), 'work_notes', 'old-note')));
  });
  it('lets a guest list exactly what lists them', async () => {
    await assertSucceeds(getDocs(mine(OMAR)));
    await assertFails(getDocs(collection(guest(OMAR), 'work_notes')));
  });
});

describe('writing a note', () => {
  it('lets a guest write their own, in a project they are on or none', async () => {
    await assertSucceeds(setDoc(doc(guest(OMAR), 'work_notes', 'a'), newNote(OMAR)));
    await assertSucceeds(setDoc(doc(guest(OMAR), 'work_notes', 'b'), newNote(OMAR, { projectId: null, viewerUids: [OMAR] })));
  });
  it('refuses another\'s name, a project they are not on, wrong readers, or a head start on permission', async () => {
    await assertFails(setDoc(doc(guest(OMAR), 'work_notes', 'a'), newNote(SARA)));
    await assertFails(setDoc(doc(guest(LINA), 'work_notes', 'a'), newNote(LINA, { viewerUids: [SARA, OMAR] })));
    await assertFails(setDoc(doc(guest(OMAR), 'work_notes', 'a'), newNote(OMAR, { viewerUids: [OMAR] })));
    await assertFails(setDoc(doc(guest(OMAR), 'work_notes', 'a'), newNote(OMAR, { projectId: null, viewerUids: [OMAR, SARA] })));
    await assertFails(setDoc(doc(guest(OMAR), 'work_notes', 'a'), newNote(OMAR, { editorUids: [SARA] })));
  });
  it('lets Hamed write anything', async () => {
    await assertSucceeds(setDoc(doc(owner(), 'work_notes', 'h'), { title: 'x', markdown: '', projectId: 'p1', viewerUids: [SARA, OMAR], editorUids: [], createdAt: 'a', updatedAt: 'b' }));
    await assertSucceeds(setDoc(doc(owner(), 'work_notes', 'sara-note'), { title: 'by Hamed' }, { merge: true }));
  });
});

describe('changing a note', () => {
  it('lets its author change the text, not who wrote it, where it is or who reads it', async () => {
    await assertSucceeds(setDoc(doc(guest(SARA), 'work_notes', 'sara-note'), { title: 'new', markdown: 'n', updatedAt: 'c' }, { merge: true }));
    await assertFails(setDoc(doc(guest(SARA), 'work_notes', 'sara-note'), { authorUid: OMAR }, { merge: true }));
    await assertFails(setDoc(doc(guest(SARA), 'work_notes', 'sara-note'), { projectId: null }, { merge: true }));
    await assertFails(setDoc(doc(guest(SARA), 'work_notes', 'sara-note'), { viewerUids: [SARA, OMAR, LINA] }, { merge: true }));
  });
  it('keeps another guest to reading until they are given permission', async () => {
    await assertFails(setDoc(doc(guest(OMAR), 'work_notes', 'sara-note'), { markdown: 'mine', updatedAt: 'c' }, { merge: true }));
    await assertFails(setDoc(doc(guest(OMAR), 'work_notes', 'hamed-note'), { markdown: 'mine', updatedAt: 'c' }, { merge: true }));
  });
  it('lets the author give permission, only to someone who can read it', async () => {
    await assertSucceeds(setDoc(doc(guest(SARA), 'work_notes', 'sara-note'), { editorUids: arrayUnion(OMAR), updatedAt: 'c' }, { merge: true }));
    await assertFails(setDoc(doc(guest(SARA), 'work_notes', 'sara-note'), { editorUids: arrayUnion(LINA), updatedAt: 'c' }, { merge: true }));
  });
  it('lets someone given permission change the text, but not hand out permission or delete', async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'work_notes', 'sara-note'), { editorUids: [OMAR] }, { merge: true }));
    await assertSucceeds(setDoc(doc(guest(OMAR), 'work_notes', 'sara-note'), { markdown: 'omar was here', updatedAt: 'c' }, { merge: true }));
    await assertFails(setDoc(doc(guest(OMAR), 'work_notes', 'sara-note'), { editorUids: arrayUnion(OMAR, SARA), updatedAt: 'c' }, { merge: true }));
    await assertFails(deleteDoc(doc(guest(OMAR), 'work_notes', 'sara-note')));
  });
  it('lets only the author (or Hamed) delete', async () => {
    await assertFails(deleteDoc(doc(guest(OMAR), 'work_notes', 'sara-note')));
    await assertFails(deleteDoc(doc(guest(OMAR), 'work_notes', 'hamed-note')));
    await assertSucceeds(deleteDoc(doc(guest(SARA), 'work_notes', 'sara-note')));
    await assertSucceeds(deleteDoc(doc(owner(), 'work_notes', 'hamed-note')));
  });
});

describe('asking for permission', () => {
  const ask = (uid: string, noteId: string, authorKey: string, over: Record<string, unknown> = {}) =>
    ({ noteId, noteTitle: 'S', requesterUid: uid, requesterName: uid, authorKey, at: '2026-11-09T10:00:00Z', ...over });

  it('lets a reader of a note ask its author, or Hamed for his', async () => {
    await assertSucceeds(setDoc(doc(guest(OMAR), 'note_edit_requests', `sara-note_${OMAR}`), ask(OMAR, 'sara-note', SARA)));
    await assertSucceeds(setDoc(doc(guest(OMAR), 'note_edit_requests', `hamed-note_${OMAR}`), ask(OMAR, 'hamed-note', 'owner')));
  });
  it('refuses someone who cannot read the note, asking in another\'s name, or naming the wrong author', async () => {
    await assertFails(setDoc(doc(guest(LINA), 'note_edit_requests', `sara-note_${LINA}`), ask(LINA, 'sara-note', SARA)));
    await assertFails(setDoc(doc(guest(OMAR), 'note_edit_requests', `sara-note_${SARA}`), ask(SARA, 'sara-note', SARA)));
    await assertFails(setDoc(doc(guest(OMAR), 'note_edit_requests', `sara-note_${OMAR}`), ask(OMAR, 'sara-note', 'owner')));
    await assertFails(setDoc(doc(guest(OMAR), 'note_edit_requests', 'wrong-id'), ask(OMAR, 'sara-note', SARA)));
  });
  it('is read by who asked, who answers, and Hamed; deleted by the same', async () => {
    await assertSucceeds(setDoc(doc(guest(OMAR), 'note_edit_requests', `sara-note_${OMAR}`), ask(OMAR, 'sara-note', SARA)));
    await assertSucceeds(getDoc(doc(guest(OMAR), 'note_edit_requests', `sara-note_${OMAR}`)));
    await assertSucceeds(getDoc(doc(guest(SARA), 'note_edit_requests', `sara-note_${OMAR}`)));
    await assertSucceeds(getDoc(doc(owner(), 'note_edit_requests', `sara-note_${OMAR}`)));
    await assertFails(getDoc(doc(guest(LINA), 'note_edit_requests', `sara-note_${OMAR}`)));
    await assertFails(deleteDoc(doc(guest(LINA), 'note_edit_requests', `sara-note_${OMAR}`)));
    await assertSucceeds(deleteDoc(doc(guest(SARA), 'note_edit_requests', `sara-note_${OMAR}`)));
  });
});

describe('a deleted note\'s marker', () => {
  const at = { at: '2026-11-09T10:00:00Z' };
  it('is left by Hamed, or a guest, only once the note is gone', async () => {
    await assertFails(setDoc(doc(guest(SARA), 'work_notes_deleted', 'sara-note'), at)); // still there
    await assertSucceeds(setDoc(doc(guest(SARA), 'work_notes_deleted', 'gone'), at));
    await assertSucceeds(setDoc(doc(owner(), 'work_notes_deleted', 'gone2'), at));
  });
  it('is read by Hamed only', async () => {
    await assertSucceeds(setDoc(doc(owner(), 'work_notes_deleted', 'gone2'), at));
    await assertSucceeds(getDoc(doc(owner(), 'work_notes_deleted', 'gone2')));
    await assertFails(getDoc(doc(guest(SARA), 'work_notes_deleted', 'gone2')));
  });
});
