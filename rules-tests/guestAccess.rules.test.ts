import { readFileSync } from 'fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const OWNER = 'bPw2qdHsBJOwSmrNKMRtlZghfiU2';
const GUEST = 'guest1';
const EMAIL = 'guest@example.com';
const google = { email_verified: true, firebase: { sign_in_provider: 'google.com' } };

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'haus-rules-test', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const guest = (uid = GUEST, email = EMAIL) => env.authenticatedContext(uid, { email, ...google }).firestore();
const owner = () => env.authenticatedContext(OWNER, { email: 'owner@example.com', ...google }).firestore();
const seed = (fn: (db: any) => Promise<void>) => env.withSecurityRulesDisabled(async (c) => fn(c.firestore()));
const invite = (active = true) => seed((db) => setDoc(doc(db, 'members', EMAIL), { active }));
const issueCode = (code = '12345678', expiresAt = Date.now() + 5 * 60_000) =>
  seed((db) => setDoc(doc(db, 'guest_codes', GUEST), { uid: GUEST, email: EMAIL, code, expiresAt }));
const submit = (code: string) => setDoc(doc(guest(), 'guest_approvals', GUEST), { code, approvedAt: serverTimestamp() });

describe('a guest asking for a code', () => {
  it('can ask once invited', async () => {
    await invite();
    await assertSucceeds(setDoc(doc(guest(), 'guest_requests', GUEST), { email: EMAIL, requestedAt: serverTimestamp() }));
  });
  it('cannot ask without an invitation, or when switched off', async () => {
    await assertFails(setDoc(doc(guest(), 'guest_requests', GUEST), { email: EMAIL, requestedAt: serverTimestamp() }));
    await invite(false);
    await assertFails(setDoc(doc(guest(), 'guest_requests', GUEST), { email: EMAIL, requestedAt: serverTimestamp() }));
  });
  it('cannot read the code Hamed issued', async () => {
    await invite(); await issueCode();
    await assertFails(getDoc(doc(guest(), 'guest_codes', GUEST)));
    await assertSucceeds(getDoc(doc(owner(), 'guest_codes', GUEST)));
  });
});

describe('typing the code', () => {
  it('is accepted when it matches and is live', async () => {
    await invite(); await issueCode('12345678');
    await assertSucceeds(submit('12345678'));
  });
  it('is refused when wrong, expired, or never issued', async () => {
    await invite();
    await assertFails(submit('12345678'));                        // never issued
    await issueCode('12345678');
    await assertFails(submit('87654321'));                        // wrong
    await issueCode('12345678', Date.now() - 1000);
    await assertFails(submit('12345678'));                        // expired
  });
  it('is refused for a guest who is not invited or switched off', async () => {
    await issueCode('12345678');
    await assertFails(submit('12345678'));
    await invite(false);
    await assertFails(submit('12345678'));
  });
  it('cannot be forged: another guest, a future approvedAt, or extra fields', async () => {
    await invite(); await issueCode('12345678');
    await assertFails(setDoc(doc(guest('guest2', 'other@example.com'), 'guest_approvals', GUEST), { code: '12345678', approvedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(guest(), 'guest_approvals', GUEST), { code: '12345678', approvedAt: new Date(Date.now() + 9e9) }));
    await assertFails(setDoc(doc(guest(), 'guest_approvals', GUEST), { code: '12345678', approvedAt: serverTimestamp(), extra: 1 }));
  });
  it('cannot be redone while an approval is still valid', async () => {
    await invite(); await issueCode('12345678');
    await assertSucceeds(submit('12345678'));
    await assertFails(submit('12345678'));
  });
});

describe('a code that was deleted', () => {
  it('cannot be used, which is why the banner only hides a card and never deletes the code', async () => {
    await invite(); await issueCode('12345678');
    await seed((db) => deleteDoc(doc(db, 'guest_codes', GUEST)));
    await assertFails(submit('12345678'));
  });
});

describe('what an approved guest may reach', () => {
  it('own data only, and nothing before approval', async () => {
    await invite();
    await assertFails(setDoc(doc(guest(), 'users', GUEST, 'data', 'water'), { value: 1, updatedAt: 'x' }));
    await issueCode('12345678'); await assertSucceeds(submit('12345678'));
    await assertSucceeds(setDoc(doc(guest(), 'users', GUEST, 'data', 'water'), { value: 1, updatedAt: 'x' }));
    await assertFails(setDoc(doc(guest(), 'users', 'someone-else', 'data', 'water'), { value: 1, updatedAt: 'x' }));
    await assertFails(getDoc(doc(guest(), 'dashboard', 'water')));
    await assertSucceeds(getDoc(doc(guest(), 'members', EMAIL)));            // their own invitation
    await assertFails(getDoc(doc(guest(), 'members', 'someone@example.com'))); // nobody else's
  });
  it('an approval older than 30 days no longer counts', async () => {
    await invite();
    await seed((db) => setDoc(doc(db, 'guest_approvals', GUEST), { code: 'x', approvedAt: new Date(Date.now() - 31 * 864e5) }));
    await assertFails(setDoc(doc(guest(), 'users', GUEST, 'data', 'water'), { value: 1, updatedAt: 'x' }));
  });
  it('the owner reaches his dashboard; a stranger reaches nothing', async () => {
    await assertSucceeds(setDoc(doc(owner(), 'dashboard', 'water'), { value: 1, updatedAt: 'x' }));
    await assertFails(getDoc(doc(guest('stranger', 'nobody@example.com'), 'dashboard', 'water')));
  });
});

describe('the activity log', () => {
  const entry = (extra: object = {}) => ({ uid: GUEST, name: 'Mona', type: 'task_status', text: 'Moved a task', at: serverTimestamp(), ...extra });
  const approve = async () => { await invite(); await issueCode('12345678'); await assertSucceeds(submit('12345678')); };

  it('an approved guest can log their own action, and nothing before approval', async () => {
    await invite();
    await assertFails(setDoc(doc(guest(), 'activity_log', 'a'), entry()));
    await issueCode('12345678'); await assertSucceeds(submit('12345678'));
    await assertSucceeds(setDoc(doc(guest(), 'activity_log', 'a'), entry()));
  });
  it('cannot log as someone else, with a made-up time, an unknown type or extra fields', async () => {
    await approve();
    await assertFails(setDoc(doc(guest(), 'activity_log', 'b'), entry({ uid: 'someone-else' })));
    await assertFails(setDoc(doc(guest(), 'activity_log', 'c'), entry({ at: new Date('2020-01-01') })));
    await assertFails(setDoc(doc(guest(), 'activity_log', 'd'), entry({ type: 'hack' })));
    await assertFails(setDoc(doc(guest(), 'activity_log', 'e'), entry({ extra: 1 })));
    await assertFails(setDoc(doc(guest(), 'activity_log', 'f'), entry({ text: 'x'.repeat(300) })));
  });
  it('cannot be read, changed or removed by a guest; the owner reads it', async () => {
    await approve();
    await assertSucceeds(setDoc(doc(guest(), 'activity_log', 'a'), entry()));
    await assertFails(getDoc(doc(guest(), 'activity_log', 'a')));
    await assertFails(setDoc(doc(guest(), 'activity_log', 'a'), entry({ text: 'edited' }), { merge: true }));
    await assertSucceeds(getDoc(doc(owner(), 'activity_log', 'a')));
  });
});
