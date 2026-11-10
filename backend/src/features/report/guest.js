import { getUserValue, listDocuments, listWhereContains } from '../../lib/firestore.js';
import { buildFocus, buildHighlights, buildLogs, buildWater, describeDate, duration, isoKey } from './data.js';
import { deadlineOf } from '../mailNotifications.js';

// The daily report for a guest: the same report as Hamed's — same look, same water and focus rules — about that one person,
// with their own tasks in place of the money. Their values live in `users/{uid}/data/{key}` (the owner's in `dashboard/{key}`),
// in the same shape, so the same builders read them.

/** Reads one guest's raw dashboard values and their tasks. */
export async function collectGuestRaw(uid) {
  const [glasses, hydrationHistory, dailyHistory, pomodoroWeek, pomodoroHistory, pomodoroLogs, tasks] = await Promise.all([
    getUserValue(uid, 'hydration_glasses', 0),
    getUserValue(uid, 'hydration_history', {}),
    getUserValue(uid, 'daily_history', {}),
    getUserValue(uid, 'pomodoro_week', null),
    getUserValue(uid, 'pomodoro_history', {}),
    getUserValue(uid, 'pomodoro_logs', []),
    listWhereContains('work_tasks', 'assigneeUids', uid),
  ]);
  return { glasses, hydrationHistory, dailyHistory, pomodoroWeek, pomodoroHistory, pomodoroLogs, tasks };
}

const isOpen = (t) => t.status === 'todo' || t.status === 'doing';
const titleOf = (t) => (t.title || '').trim() || 'Untitled';

/** A person's tasks as the report shows them: what they finished today, what is open, and what is late. */
export function buildGuestTasks(tasks, now) {
  const today = isoKey(now);
  const list = Array.isArray(tasks) ? tasks : [];
  const doneToday = list.filter((t) => t.status === 'done' && t.doneAt && isoKey(new Date(t.doneAt)) === today);
  const open = list.filter(isOpen);
  const late = open.filter((t) => { const last = deadlineOf(t); return last !== null && last < today; });
  const dueToday = open.filter((t) => t.date && t.date <= today && (deadlineOf(t) ?? t.date) >= today);
  return {
    doneToday: doneToday.map(titleOf),
    doneCount: doneToday.length,
    openCount: open.length,
    lateCount: late.length,
    dueToday: dueToday.map(titleOf),
    late: late.map(titleOf),
  };
}

/** The report for one person: `person` is `{ name }`. */
export function buildGuestReport(raw, person, now = new Date()) {
  const water = buildWater(raw, now);
  const focus = buildFocus(raw, now);
  const tasks = buildGuestTasks(raw.tasks, now);
  // Water and focus lines are the same as Hamed's; the money lines have nothing to say here.
  const base = buildHighlights({ water, focus, finance: { upcoming: [], share: { amount: 0 }, free: 0, thndr: null } });
  const highlights = [...base];
  if (tasks.doneCount) highlights.push({ tone: 'good', text: `Finished ${tasks.doneCount} ${tasks.doneCount === 1 ? 'task' : 'tasks'} today.` });
  if (tasks.lateCount) highlights.push({ tone: 'warn', text: `${tasks.lateCount} ${tasks.lateCount === 1 ? 'task is' : 'tasks are'} late.` });
  else if (tasks.openCount) highlights.push({ tone: 'info', text: `${tasks.openCount} ${tasks.openCount === 1 ? 'task' : 'tasks'} still open.` });
  return {
    generatedAt: now,
    person: { name: person.name },
    date: describeDate(now),
    water, focus, tasks,
    logs: buildLogs(raw, focus.sessions),
    highlights,
  };
}

/** The people to report on: guests switched on, who have signed in (so their uid is known), with the name to call them. */
export async function reportRecipients() {
  const [members, profiles] = await Promise.all([listDocuments('members'), listDocuments('guest_profiles')]);
  const byEmail = new Map(profiles.map((p) => [p.email, p]));
  return members
    .filter((m) => m.active === true)
    .flatMap((m) => {
      const profile = byEmail.get(m.email);
      return profile ? [{ uid: profile.id, name: m.name || profile.name || m.email.split('@')[0] }] : [];
    });
}

/** The summary rows of a guest's Discord card. */
export const guestCardRows = (report) => [
  ['Water', `${report.water.glasses} / ${report.water.goal}`],
  ['Focus', duration(report.focus.minutes)],
  ['Tasks done today', String(report.tasks.doneCount)],
  ['Open', String(report.tasks.openCount)],
  ['Late', String(report.tasks.lateCount)],
];
