import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendEmbed } from '../lib/alerts.js';
import { NAME } from '../lib/brand.js';
import { dashboardConfigured, watchDashboardValue } from '../lib/firestore.js';

// Payit (subscription) renewal reminders. The list lives in Firestore (`finance_subscriptions`, what the Payit page saves);
// the bot listens to it, so an edit from any device reaches it, and keeps a copy in memory and in a small file so a restart
// doesn't forget it. The web app still pushes each edit to the local API too, which only makes the copy current a moment sooner.

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'subscriptions.json');
const TIME_ZONE = 'Africa/Cairo';
const DEFAULT_REMINDER_TIME = '09:00';
/** How long after its minute a reminder may still go out — so a bot that was asleep or restarting then doesn't lose it. */
const GRACE_MINUTES = 180;
const SENT_FILE = path.join(path.dirname(FILE), 'subscriptions-sent.json');

let subscriptions = loadFromFile();

function loadFromFile() {
  try {
    const stored = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (Array.isArray(stored)) {
      console.log(`📂 Loaded ${stored.length} Payit from the local file`);
      return stored;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('⚠️ Failed to load Payit from file:', error.message);
  }
  return [];
}

export const getSubscriptions = () => subscriptions;

/** Follows the list the Payit page saves in Firestore. Returns a function that stops listening (or null when Firestore isn't set up). */
export function watchSubscriptions() {
  if (!dashboardConfigured()) return null;
  return watchDashboardValue('finance_subscriptions', (value) => {
    if (Array.isArray(value)) {
      replaceSubscriptions(value);
      console.log(`🔄 Payit list updated from Firestore: ${value.length}`);
    }
  });
}

/** Replaces the list with what the web app just saved, and remembers it. */
export function replaceSubscriptions(next) {
  subscriptions = next;
  try {
    fs.writeFileSync(FILE, JSON.stringify(next, null, 2), 'utf8');
  } catch (error) {
    console.error('⚠️ Failed to save Payit to file:', error.message);
  }
}

/** The wall-clock time in Cairo, as plain numbers. */
export function cairoClock(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(now)
      .map((p) => [p.type, Number(p.value)]),
  );
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute };
}

const daysInMonth = (year, month) => new Date(year, month, 0).getDate();
const pad = (n) => String(n).padStart(2, '0');

/** "HH:MM" → minutes since midnight (NaN when it isn't a time). */
const minutesOf = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};

/** The month a plan started in, as a month count (year × 12 + month, January = 0) — read from the "YYYY-MM-DD" text, not through a Date, so the machine's time zone can't move it a day. */
const startMonthIndex = (startDate) => {
  const [year, month] = String(startDate).split('-').map(Number);
  return Number.isFinite(year) && Number.isFinite(month) ? year * 12 + (month - 1) : null;
};

/**
 * Whether a subscription's reminder is due now: it is its renewal day (the last day of a short
 * month, if it falls on a 31st), its reminder time has come and no more than `GRACE_MINUTES` have
 * passed — and it is a month it actually renews in. A quarterly or yearly plan only renews every
 * `intervalMonths` from its start month. (That it goes out once is `remindDueSubscriptions`'s job.)
 */
export function isDueAt(sub, clock) {
  const renewalDay = Math.min(Number(sub.renewalDay), daysInMonth(clock.year, clock.month));
  if (clock.day !== renewalDay) return false;
  const late = clock.hour * 60 + clock.minute - minutesOf(sub.reminderTime || DEFAULT_REMINDER_TIME);
  if (!(late >= 0 && late < GRACE_MINUTES)) return false;

  const interval = sub.intervalMonths || 1;
  const start = sub.startDate ? startMonthIndex(sub.startDate) : null;
  if (start === null) return true;
  const monthsFromStart = clock.year * 12 + (clock.month - 1) - start;
  return monthsFromStart >= 0 && monthsFromStart % interval === 0;
}

const dayKey = (clock) => `${clock.year}-${pad(clock.month)}-${pad(clock.day)}`;

/** The reminders already sent today ("id:YYYY-MM-DD"), kept in a file so a restart doesn't send them again. */
function loadSent() {
  try {
    const stored = JSON.parse(fs.readFileSync(SENT_FILE, 'utf8'));
    return new Set(Array.isArray(stored) ? stored : []);
  } catch {
    return new Set();
  }
}
let sent = loadSent();

function rememberSent(keys, today) {
  sent = new Set([...keys].filter((k) => k.endsWith(`:${today}`)));
  try {
    fs.writeFileSync(SENT_FILE, JSON.stringify([...sent]), 'utf8');
  } catch (error) {
    console.error('⚠️ Failed to save the sent Payit reminders:', error.message);
  }
}

/** Posts today's reminder for one subscription. */
async function sendSubscriptionAlert(client, channelId, sub, now = new Date()) {
  const date = now.toLocaleDateString('en-EG', { timeZone: TIME_ZONE, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const amount = `${sub.cost.toLocaleString('en-EG')} EGP`;
  await sendEmbed(client, channelId, {
    title: 'Payit Renewal Due',
    color: 0xE2583A,
    description: `**${sub.name}** is renewing today — make sure it's covered.`,
    fields: [
      { name: 'Amount', value: `\`${amount}\``, inline: true },
      { name: 'Bank', value: sub.bank || '—', inline: true },
      { name: 'Date', value: date, inline: false },
    ],
    footer: { text: `${NAME} · Finance · Payit` },
    thumbnail: { url: 'https://cdn-icons-png.flaticon.com/512/2088/2088617.png' },
  }, `**Payit Due: ${sub.name}**\n${amount} · ${sub.bank || 'Unknown'}\n${date}`);
}

/** Run once a minute: sends a reminder for every subscription that is due and hasn't been told about today. */
export async function remindDueSubscriptions(client, channelId, now = new Date()) {
  const clock = cairoClock(now);
  const today = dayKey(clock);
  const due = subscriptions.filter((sub) => isDueAt(sub, clock) && !sent.has(`${sub.id ?? sub.name}:${today}`));
  if (!due.length) return;
  console.log(`[${pad(clock.hour)}:${pad(clock.minute)} Cairo] 🔔 ${due.length} Payit due`);
  for (const sub of due) {
    // Marked before sending: a send that fails or takes long isn't started twice by the next minute.
    rememberSent(new Set([...sent, `${sub.id ?? sub.name}:${today}`]), today);
    await sendSubscriptionAlert(client, channelId, sub, now);
  }
}
