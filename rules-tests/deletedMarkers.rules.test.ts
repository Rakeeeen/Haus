import { readFileSync } from 'fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

const OWNER = 'bPw2qdHsBJOwSmrNKMRtlZghfiU2';
const GUEST = 'guest1';
const EMAIL = 'guest@example.com';
const google = { email_verified: true, firebase: { sign_in_provider: 'google.com' } };

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'haus-rules-test', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  // An invited guest who has typed a valid code.
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'members', EMAIL), { email: EMAIL, active: true });
    await setDoc(doc(db, 'guest_approvals', GUEST), { code: 'x', approvedAt: Timestamp.now() });
    await setDoc(doc(db, 'work_tasks', 'live'), { title: 'still here', viewerUids: [GUEST] });
  });
});

const guest = () => env.authenticatedContext(GUEST, { email: EMAIL, ...google }).firestore();
const owner = () => env.authenticatedContext(OWNER, { email: 'owner@example.com', ...google }).firestore();
const stranger = () => env.authenticatedContext('stranger', { email: 'x@example.com', ...google }).firestore();
const at = { at: new Date().toISOString() };

describe('a deleted task\'s marker', () => {
  it('can be left by Hamed, or by a guest let in, for a task that is gone', async () => {
    await assertSucceeds(setDoc(doc(owner(), 'work_tasks_deleted', 'gone1'), at));
    await assertSucceeds(setDoc(doc(guest(), 'work_tasks_deleted', 'gone2'), at));
  });

  it('can never be left for a task that still exists', async () => {
    await assertFails(setDoc(doc(guest(), 'work_tasks_deleted', 'live'), at));
    await assertFails(setDoc(doc(owner(), 'work_tasks_deleted', 'live'), at));
  });

  it('holds only when it was deleted', async () => {
    await assertFails(setDoc(doc(owner(), 'work_tasks_deleted', 'gone1'), { ...at, title: 'x' }));
    await assertFails(setDoc(doc(owner(), 'work_tasks_deleted', 'gone1'), { at: 5 }));
  });

  it('is read by Hamed only, and left by nobody else', async () => {
    await assertSucceeds(getDoc(doc(owner(), 'work_tasks_deleted', 'gone1')));
    await assertFails(getDoc(doc(guest(), 'work_tasks_deleted', 'gone1')));
    await assertFails(setDoc(doc(stranger(), 'work_tasks_deleted', 'gone3'), at));
  });
});

describe('a deleted project\'s marker', () => {
  it('is Hamed\'s alone', async () => {
    for (const markers of ['work_projects_deleted', 'work_projects_private_deleted']) {
      await assertSucceeds(setDoc(doc(owner(), markers, 'n1'), at));
      await assertSucceeds(getDoc(doc(owner(), markers, 'n1')));
      await assertFails(setDoc(doc(guest(), markers, 'n2'), at));
      await assertFails(getDoc(doc(guest(), markers, 'n1')));
    }
  });
});
