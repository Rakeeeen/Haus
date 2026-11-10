import { getDocument, setDocument, watchCollection } from '../lib/firestore.js';
import { invitationEmail, tasksAssignedEmail, tasksOverdueEmail } from '../lib/emailTemplate.js';
import { createMailer } from '../lib/mailer.js';

// Email for the moments a person is brought in: being invited to Haus, and being given a task — and, for Hamed, a guest who
// runs a project giving someone a task. Like the focus messages, the web app doesn't send anything itself (a mail password
// can't live in a website): it writes to Firestore as always, and this watches for it and sends through the account in the
// bot's own .env.
//
// A task whose end has passed without being finished is told to who it is for, once, in a morning mail (see `checkOverdue`).
//
// The bot is not always on, so what it has told people is kept in Firestore (`mail_state/tasks`: for each task, who has been
// told it is theirs; `mail_state/invites`: when the invitations began; `mail_sent`: each invitation mailed). When the bot wakes it
// compares what is there with what it has told, and sends what it missed — with the time the thing happened, not the time it woke.

/** Hamed's own key in a task's `assigneeUids`. */
const OWNER_KEY = 'owner';
/** Tasks given to one person by one person within this window go out together as one email (an import is one email, not fifty). */
const BATCH_MS = 20 * 1000;
/** A save of the "who has been told" record waits this long, so a burst of changes is one write. */
const SAVE_MS = 3 * 1000;

/** Everyone a task is for (older tasks have only `assigneeUid`; none at all means Hamed). */
export function assigneesOf(task) {
  if (Array.isArray(task.assigneeUids) && task.assigneeUids.length) return task.assigneeUids;
  return task.assigneeUid ? [task.assigneeUid] : [OWNER_KEY];
}

/**
 * Whose doing the latest change to a task was: for a task that is new, whoever made it; for a change, the project admin who stamped it
 * (`updatedByUid`), and Hamed when nobody did (his own changes clear the stamp).
 */
export function actorOf(task, isNew) {
  const who = isNew ? task.createdByUid : task.updatedByUid;
  return who || OWNER_KEY;
}

/** When the latest change happened: a new task was made at `createdAt`, a changed one was changed at `updatedAt`. */
export const eventTime = (task, isNew) => (isNew ? task.createdAt || task.updatedAt : task.updatedAt || task.createdAt) || null;

/**
 * Who a task has newly been given to — in it now, and not among the people already told — apart from whoever did it (they
 * know). `told` is who has been told about this task, or undefined for a task the bot has not met.
 */
export function newlyGiven(told, task, actor) {
  const had = new Set(told ?? []);
  return assigneesOf(task).filter((uid) => !had.has(uid) && uid !== actor);
}

/** Of those told, the ones the task is still for: someone taken off and later put back must be told again. */
export const stillTold = (told, task) => (told ?? []).filter((uid) => assigneesOf(task).includes(uid));

/** The id an invitation is mailed under: once per invitation (its email and the moment it was made). Null when it isn't to be mailed. */
export function invitationToMail(member, since) {
  if (!member?.email || member.active !== true || !member.addedAt) return null;
  if (since && member.addedAt <= since) return null; // made before this began, or the bot was set up since: not for us to announce
  return `invite:${member.email}:${member.addedAt}`.replace(/\//g, '_');
}

/** A task's last day: its end, or its day when it has no end. Null for a task with no date. */
export const deadlineOf = (task) => {
  if (!task.date) return task.endDate || null;
  return task.endDate && task.endDate > task.date ? task.endDate : task.date; // an end before the start counts for nothing (as in the app)
};

/** Today's date in Cairo, "YYYY-MM-DD" (the day Haus's people live by). */
export function cairoDay(now) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** The hour in Cairo, 0–23. */
export const cairoHour = (now) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', hour: 'numeric', hourCycle: 'h23' }).format(now));

/** Whole days from `from` to `to` (both "YYYY-MM-DD"). */
export const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * How many days late a task is, when it is to be told about: still open, its last day passed, and that day no earlier than `since`
 * (what was already late when this began is not announced). Null otherwise.
 */
export function overdueBy(task, today, since) {
  const deadline = deadlineOf(task);
  if (!deadline || !isOpenTask(task) || deadline >= today || deadline < since) return null;
  return daysBetween(deadline, today);
}

/** The id an overdue notice to one person is kept under: once per task, per last day, per person. */
export const overdueKey = (task, who) => `overdue:${task.id}:${deadlineOf(task)}:${who}`.replace(/\//g, '_');

/** The morning hour (Cairo) from which overdue notices go out. */
const OVERDUE_FROM_HOUR = 9;

/** Whether a task is still worth telling someone about. */
export const isOpenTask = (task) => task.status !== 'done' && task.status !== 'dropped';

const FIRESTORE = { getDocument, setDocument, watchCollection };

/** Starts the bot's email, from the account in its .env; does nothing (and says so) without one. */
export function watchMailNotifications() {
  const mailer = createMailer();
  if (!mailer) {
    console.log('⚠️ MAIL_USER / MAIL_PASSWORD are not set — invitation and task emails are off');
    return Promise.resolve();
  }
  return startMailWatch({ mailer, store: FIRESTORE });
}

/**
 * The watching itself, with its mailer and its store handed in (so it can be tried against a pretend Firestore). Resolves once
 * the invitations and the tasks are being watched; what it sends later goes out on its own.
 */
export async function startMailWatch({ mailer, store, batchMs = BATCH_MS, saveMs = SAVE_MS, overdueEveryMs = 10 * 60 * 1000 }) {
  const { getDocument, setDocument, watchCollection } = store;
  const { ownerName, ownerEmail, appUrl } = mailer.config;
  const safely = (what, job) => job().catch((error) => console.error(`❌ ${what}:`, error.message));

  const names = new Map();
  /** A guest's name, as they gave it (or as Hamed named them). */
  const nameOf = async (uid) => {
    if (uid === OWNER_KEY) return ownerName;
    if (!names.has(uid)) {
      const profile = await getDocument('guest_profiles', uid);
      const member = profile?.email ? await getDocument('members', profile.email) : null;
      names.set(uid, member?.name || profile?.name || 'زميل');
    }
    return names.get(uid);
  };
  /** A guest who is still invited and active, with where to write to them. */
  const contactOf = async (uid) => {
    const profile = await getDocument('guest_profiles', uid);
    if (!profile?.email) return null;
    const member = await getDocument('members', profile.email);
    return member?.active === true ? { email: profile.email, name: member.name || profile.name } : null;
  };

  // ── Invitations ────────────────────────────────────────────────────────────────
  const inFlight = new Set();
  let since = null;
  const mailInvitation = (member) => safely('Invitation email', async () => {
    const id = invitationToMail(member, since);
    if (!id || inFlight.has(id)) return;
    inFlight.add(id);
    try {
      if (await getDocument('mail_sent', id)) return;
      await mailer.send({ to: member.email, ...invitationEmail({ inviter: ownerName, name: member.name, appUrl, at: member.addedAt }) });
      await setDocument('mail_sent', id, { at: new Date().toISOString() });
      console.log(`📧 Invited ${member.email}`);
    } catch (error) {
      inFlight.delete(id); // a failed send may be tried again by the next change to the invitation
      throw error;
    }
  });
  await safely('Invitation watcher', async () => {
    // Invitations made before this began are not announced; those made after it — even while the bot was off — are.
    const state = await getDocument('mail_state', 'invites');
    since = state?.since ?? new Date().toISOString();
    if (!state) await setDocument('mail_state', 'invites', { since });
    watchCollection('members', (snap) => snap.docChanges().forEach((change) => change.type !== 'removed' && mailInvitation(change.doc.data())));
  });

  // ── Tasks ──────────────────────────────────────────────────────────────────────
  /** Who has been told about each task: task id → uids. Null until it is read; a bot that has never run starts from what is there. */
  let told = null;
  /** Every task as last seen, for the overdue check. */
  const current = new Map();
  let saveTimer = null;
  const save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => safely('Saving mail state', () => setDocument('mail_state', 'tasks', { told: Object.fromEntries(told), at: new Date().toISOString() })), saveMs);
  };

  /** actor|recipient → { actor, to, items: [{ task, at }] }, sent together after a short wait. */
  const waiting = new Map();
  const timers = new Map();

  const sendBatch = (key) => safely('Task email', async () => {
    const batch = waiting.get(key);
    waiting.delete(key);
    timers.delete(key);
    if (!batch) return;
    const { actor, to, items } = batch;
    // Only what is still open — and for a guest, the project's name only if they are on it (a client's or a hidden project is not theirs to read).
    const shown = [];
    for (const { task, at } of items) {
      if (!isOpenTask(task)) continue;
      const project = task.projectId ? await getDocument('work_projects', task.projectId) : null;
      const visible = project && (to === OWNER_KEY || project.memberUids?.includes(to));
      shown.push({ task, at, projectName: visible ? project.name : null });
    }
    const markTold = () => items.forEach(({ task }) => { told.set(task.id, [...new Set([...(told.get(task.id) ?? []), to])]); });
    if (!shown.length) { markTold(); save(); return; }
    const giver = await nameOf(actor);
    const at = shown[0].at;

    if (to === OWNER_KEY) {
      // A guest who runs a project gave Hamed a task.
      await mailer.send({ to: ownerEmail, ...tasksAssignedEmail({ giver, name: ownerName, items: shown, appUrl, at }) });
      console.log(`📧 Told ${ownerName} that ${giver} gave him ${shown.length} task(s)`);
    } else {
      const contact = await contactOf(to);
      if (!contact) return; // not signed in yet, or switched off: tried again at the next change
      await mailer.send({ to: contact.email, ...tasksAssignedEmail({ giver, name: contact.name, items: shown, appUrl, at }) });
      console.log(`📧 Told ${contact.email} about ${shown.length} task(s) from ${giver}`);
      // Hamed hears of what a guest who runs a project hands out to someone else.
      if (actor !== OWNER_KEY) {
        await safely('Notice to Hamed', () => mailer.send({ to: ownerEmail, ...tasksAssignedEmail({ giver, name: ownerName, forName: contact.name, items: shown, appUrl, at }) }));
      }
    }
    markTold();
    save();
  });

  const queue = (actor, to, task, at) => {
    const key = `${actor}|${to}`;
    const batch = waiting.get(key) ?? { actor, to, items: [] };
    batch.items.push({ task, at });
    waiting.set(key, batch);
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => sendBatch(key), batchMs));
  };

  await safely('Task watcher', async () => {
    const state = await getDocument('mail_state', 'tasks');
    // Only the very first snapshot of a bot that has never run counts as "already told": a task made after it is new.
    let baseline = !state;
    told = new Map(Object.entries(state?.told ?? {}));

    watchCollection('work_tasks', (snap) => {
      snap.docChanges().forEach((change) => {
        const id = change.doc.id;
        if (change.type === 'removed') { told.delete(id); current.delete(id); save(); return; }
        const task = { id, ...change.doc.data() };
        current.set(id, task);
        const before = told.get(id);
        // The first time ever: everything already here counts as told.
        if (baseline && before === undefined) { told.set(id, assigneesOf(task)); return; }
        const isNew = before === undefined;
        const actor = actorOf(task, isNew);
        const given = newlyGiven(before, task, actor);
        // Taken off, or done by the one who did it: they know. What is left to tell is sent; the rest is kept as told.
        told.set(id, [...new Set([...stillTold(before, task), ...(assigneesOf(task).includes(actor) ? [actor] : [])])]);
        for (const to of given) queue(actor, to, task, eventTime(task, isNew));
      });
      baseline = false;
      save();
    });
    console.log(!state ? '📧 First run: every task already here counts as told' : '📧 Caught up with the tasks given while the bot was off');
  });

  // ── Overdue ────────────────────────────────────────────────────────────────────
  /**
   * From 9 in the morning (Cairo), tells each person whose task's last day has passed without it being done — one mail with all of
   * theirs, once per task. Run every few minutes, so a bot that was off at 9 sends when it wakes. What was late before this first
   * ran is not announced.
   */
  let overdueState = null;
  const overdueSent = new Set(); // overdue mails already sent (or found sent), so they are not looked up again every few minutes
  const checkOverdue = (now = new Date()) => safely('Overdue check', async () => {
    if (cairoHour(now) < OVERDUE_FROM_HOUR) return;
    const today = cairoDay(now);
    // Read once, then kept: this runs every few minutes, and each read is one of Firestore's free daily reads.
    overdueState ??= await getDocument('mail_state', 'overdue');
    if (!overdueState) { overdueState = { since: today }; await setDocument('mail_state', 'overdue', overdueState); }
    const state = overdueState;
    const byPerson = new Map();
    for (const task of current.values()) {
      const late = overdueBy(task, today, state.since);
      if (late === null) continue;
      for (const who of assigneesOf(task)) byPerson.set(who, [...(byPerson.get(who) ?? []), { task, late }]);
    }
    for (const [who, list] of byPerson) {
      const fresh = [];
      for (const item of list) {
        const key = overdueKey(item.task, who);
        if (overdueSent.has(key)) continue;
        if (await getDocument('mail_sent', key)) { overdueSent.add(key); continue; }
        fresh.push(item);
      }
      if (!fresh.length) continue;
      const contact = who === OWNER_KEY ? { email: ownerEmail, name: ownerName } : await contactOf(who);
      if (!contact) continue;
      const items = [];
      for (const { task, late } of fresh.sort((a, b) => b.late - a.late)) {
        const project = task.projectId ? await getDocument('work_projects', task.projectId) : null;
        items.push({ task, late, projectName: project && (who === OWNER_KEY || project.memberUids?.includes(who)) ? project.name : null });
      }
      await mailer.send({ to: contact.email, ...tasksOverdueEmail({ name: contact.name, items, appUrl }) });
      for (const { task } of items) { await setDocument('mail_sent', overdueKey(task, who), { at: new Date().toISOString() }); overdueSent.add(overdueKey(task, who)); }
      console.log(`📧 Told ${contact.email} that ${items.length} task(s) are overdue`);
    }
  });
  // Once the tasks have been read, and then every few minutes.
  setTimeout(() => checkOverdue(), 5000).unref?.();
  setInterval(() => checkOverdue(), overdueEveryMs).unref?.();

  console.log('📧 Watching invitations and task assignments for email');
  return { checkOverdue };
}
