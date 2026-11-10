import { getDocument, setDocument, watchCollection } from '../lib/firestore.js';
import { invitationEmail, tasksAssignedEmail } from '../lib/emailTemplate.js';
import { createMailer } from '../lib/mailer.js';

// Email for the two moments a person is brought in: being invited to Haus, and being given a task. Like the focus
// messages, the web app doesn't send anything itself (a mail password can't live in a website): it writes to
// Firestore as always, and this watches for it and sends through the account in the bot's own .env.

/** Hamed's own key in a task's `assigneeUids`. */
const OWNER_KEY = 'owner';
/** An invitation older than this is not mailed — e.g. one made while the bot was off. */
const INVITATION_FRESH_MS = 10 * 60 * 1000;
/** Tasks given to one person within this window go out together as one email (an import is one email, not fifty). */
const BATCH_MS = 20 * 1000;

/** Everyone a task is for (older tasks have only `assigneeUid`; none at all means Hamed). */
export function assigneesOf(task) {
  if (Array.isArray(task.assigneeUids) && task.assigneeUids.length) return task.assigneeUids;
  return task.assigneeUid ? [task.assigneeUid] : [OWNER_KEY];
}

/** The guests a task has just been given to: in `next` and not in `before` (all of them, for a task that is new), never its maker. */
export function newlyGivenTo(before, task) {
  const had = new Set(before ?? []);
  return assigneesOf(task).filter((uid) => uid !== OWNER_KEY && !had.has(uid) && uid !== task.createdByUid);
}

/** The id an invitation is mailed under: once per invitation (its email and the moment it was made). Null when it isn't to be mailed. */
export function invitationToMail(member, now = Date.now()) {
  if (!member?.email || member.active !== true || !member.addedAt) return null;
  if (now - Date.parse(member.addedAt) > INVITATION_FRESH_MS) return null;
  return `invite:${member.email}:${member.addedAt}`.replace(/\//g, '_');
}

/** Whether a task is still worth telling someone about. */
export const isOpenTask = (task) => task.status !== 'done' && task.status !== 'dropped';

export function watchMailNotifications() {
  const mailer = createMailer();
  if (!mailer) {
    console.log('⚠️ MAIL_USER / MAIL_PASSWORD are not set — invitation and task emails are off');
    return;
  }
  const { ownerName, appUrl } = mailer.config;

  const safely = (what, job) => job().catch((error) => console.error(`❌ ${what}:`, error.message));

  // ── Invitations ────────────────────────────────────────────────────────────────
  const inFlight = new Set();
  const mailInvitation = (member) => safely('Invitation email', async () => {
    const id = invitationToMail(member);
    if (!id || inFlight.has(id)) return;
    inFlight.add(id);
    try {
      if (await getDocument('mail_sent', id)) return;
      await mailer.send({ to: member.email, ...invitationEmail({ inviter: ownerName, name: member.name, email: member.email, appUrl }) });
      await setDocument('mail_sent', id, { at: new Date().toISOString() });
      console.log(`📧 Invited ${member.email}`);
    } catch (error) {
      inFlight.delete(id); // a failed send may be tried again by the next change to the invitation
      throw error;
    }
  });
  watchCollection('members', (snap) => snap.docChanges().forEach((change) => change.type !== 'removed' && mailInvitation(change.doc.data())));

  // ── Tasks ──────────────────────────────────────────────────────────────────────
  const known = new Map();           // task id → who it was for, as last seen
  const waiting = new Map();         // guest uid → { tasks, timer }
  let seeded = false;

  const profileOf = async (uid) => {
    const profile = await getDocument('guest_profiles', uid);
    if (!profile?.email) return null;
    const member = await getDocument('members', profile.email);
    return member?.active === true ? { ...profile, name: member.name || profile.name } : null;
  };

  const flush = (uid) => safely('Task email', async () => {
    const batch = waiting.get(uid);
    waiting.delete(uid);
    if (!batch) return;
    const profile = await profileOf(uid);
    if (!profile) return;
    // Only what is still open, and the project's name only if this guest is on it (a client's or a hidden project is not theirs to read).
    const items = [];
    for (const task of batch.tasks) {
      if (!isOpenTask(task)) continue;
      const project = task.projectId ? await getDocument('work_projects', task.projectId) : null;
      items.push({ task, projectName: project?.memberUids?.includes(uid) ? project.name : null });
    }
    if (!items.length) return;
    const giver = batch.tasks[0].createdByUid ? (await getDocument('guest_profiles', batch.tasks[0].createdByUid))?.name || 'A teammate' : ownerName;
    await mailer.send({ to: profile.email, ...tasksAssignedEmail({ giver, name: profile.name, items, appUrl }) });
    console.log(`📧 Told ${profile.email} about ${items.length} task${items.length === 1 ? '' : 's'}`);
  });

  const queue = (uid, task) => {
    const batch = waiting.get(uid) ?? { tasks: [], timer: null };
    batch.tasks.push(task);
    clearTimeout(batch.timer);
    batch.timer = setTimeout(() => flush(uid), BATCH_MS);
    waiting.set(uid, batch);
  };

  watchCollection('work_tasks', (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === 'removed') { known.delete(change.doc.id); return; }
      const task = { id: change.doc.id, ...change.doc.data() };
      const before = known.get(task.id);
      known.set(task.id, assigneesOf(task));
      // The first snapshot is everything that was already there when the bot started — never mail that.
      if (!seeded) return;
      for (const uid of newlyGivenTo(before, task)) queue(uid, task);
    });
    seeded = true;
  });

  console.log('📧 Watching invitations and task assignments for email');
}
