import { readState as readWaterState } from '../features/water.js';
import { readFocusState } from '../features/focus.js';
import { readFinanceSummary, readBanks, readBucketsDetail, BANK_LABELS, BUCKET_LABELS } from '../features/finance.js';
import { formatDurationText, formatEGP } from '../lib/format.js';
import { NAME } from '../lib/brand.js';

/**
 * The Slack side of the control panel: Block Kit versions of the same cards the Discord bot draws.
 * Every builder returns `{ text, blocks }` — `text` is the notification/fallback line. The state
 * comes from the same readers the Discord cards use, so the two can't disagree about what's on screen.
 * Slack has no disabled buttons, so a button that can't be used right now is simply left out.
 */

const GOAL = 12;
const LABELS = { water: 'Water', focus: 'Focus', finance: 'Finance', system: NAME };

const text = (t) => ({ type: 'plain_text', text: t, emoji: false });
const md = (t) => ({ type: 'mrkdwn', text: t });

/** One button; `style` is 'primary' (green), 'danger' (red) or omitted. */
const button = (id, label, style) => ({ type: 'button', action_id: id, text: text(label), ...(style ? { style } : {}) });
const actions = (buttons) => ({ type: 'actions', elements: buttons });

function card({ domain, headline, big, fields = [], buttons = [] }) {
  // The name's Arabic marks fall apart when upper-cased, so only the plain labels are.
  const label = domain === 'system' ? LABELS[domain] : LABELS[domain].toUpperCase();
  const blocks = [{ type: 'context', elements: [md(`*${label}*`)] }];
  if (big) blocks.push({ type: 'header', text: text(big) });
  if (headline) blocks.push({ type: 'section', text: md(headline) });
  if (fields.length) blocks.push({ type: 'section', fields: fields.map(([name, value]) => md(`*${name}*\n${value}`)) });
  for (const group of buttons) blocks.push(actions(group));
  return { text: [LABELS[domain], big, headline].filter(Boolean).join(' — '), blocks };
}

const MAIN_MENU = button('bommy:home', 'Main Menu');

export function hubView() {
  return card({
    domain: 'system',
    big: `${NAME} Control`,
    headline: 'Tap a card to control it from here.',
    buttons: [[button('bommy:water', 'Water', 'primary'), button('bommy:focus', 'Focus', 'primary'), button('bommy:finance', 'Finance', 'primary')]],
  });
}

export async function waterView() {
  const { glasses, shown, fridayLocked, locked } = await readWaterState();
  const big = `${shown} / ${GOAL}`;

  if (fridayLocked) {
    return card({
      domain: 'water', big,
      headline: "It's Jumu'ah — Friday is opt-in system-wide. Nothing logged counts until you opt in.",
      buttons: [[button('water:fridayoptin', 'Count Today Anyway', 'primary'), MAIN_MENU]],
    });
  }
  const buttons = [locked ? button('water:late', 'Late Glass', 'primary') : button('water:add', 'Add Glass', 'primary')];
  if (!locked && glasses > 0) buttons.push(button('water:undo', 'Undo'));
  buttons.push(MAIN_MENU);
  return card({
    domain: 'water', big, buttons: [buttons],
    headline: locked ? 'Water is closed until Fajr. *Late Glass* counts toward the day that just ended.' : 'Glasses today',
  });
}

/** The Focus card is the one left open (not auto-deleted) — marked without adding a field Slack would see. */
const persistent = (view) => Object.defineProperty(view, 'persistent', { value: true });

export async function focusView() {
  const { status, liveBig, minutesToday, sessions, idle, checkpoint, blockedReason } = await readFocusState();

  const primary = [];
  if (idle) {
    if (!blockedReason) primary.push(button('focus:start', 'Start Focus', 'primary'));
  } else if (checkpoint.mode === 'break') {
    primary.push(button('focus:skipbreak', 'Skip Break'));
  } else {
    if (checkpoint.running) primary.push(button('focus:pause', 'Pause'));
    else if (!blockedReason) primary.push(button('focus:resume', 'Resume', 'primary'));
    primary.push(button('focus:done', 'Done', 'primary'), button('focus:discard', 'Discard', 'danger'));
  }
  const fields = [['Sessions today', String(sessions)]];
  if (!liveBig) fields.push(['Focused today', formatDurationText(minutesToday)]);

  return persistent(card({
    domain: 'focus', headline: status, fields,
    big: liveBig ?? formatDurationText(minutesToday),
    buttons: [primary, [button('focus:refresh', 'Refresh'), MAIN_MENU]].filter((group) => group.length),
  }));
}

export function sessionLoggedText(focusGained, overtimeSeconds) {
  return `*Focus Session Logged* — you've logged *${formatDurationText(focusGained)}* of deep work `
    + `(overtime ${Math.floor(overtimeSeconds / 60)}m ${overtimeSeconds % 60}s).`;
}

export async function financeHomeView() {
  const { total, allocated } = await readFinanceSummary();
  return card({
    domain: 'finance', big: formatEGP(total),
    headline: "Real balance (banks) — buckets are how it's split, not extra money",
    fields: [['Allocated across buckets', formatEGP(allocated)]],
    buttons: [[button('finance:banks', 'Banks', 'primary'), button('finance:buckets', 'Buckets'), MAIN_MENU]],
  });
}

export async function banksView() {
  const banks = await readBanks();
  const keys = Object.keys(BANK_LABELS);
  return card({
    domain: 'finance', headline: 'Pick a bank to deposit or withdraw',
    fields: keys.map((k) => [BANK_LABELS[k], formatEGP(banks[k] || 0)]),
    buttons: [keys.map((k) => button(`finance:bank:${k}`, BANK_LABELS[k])), [button('finance:home', 'Back')]],
  });
}

export async function bankView(bankKey) {
  const banks = await readBanks();
  return card({
    domain: 'finance', headline: BANK_LABELS[bankKey], big: formatEGP(banks[bankKey] || 0),
    buttons: [[
      button(`finance:deposit:${bankKey}`, 'Deposit', 'primary'),
      button(`finance:withdraw:${bankKey}`, 'Withdraw', 'danger'),
      button('finance:banks', 'Back'),
    ]],
  });
}

export async function bucketsView() {
  const { buckets, future } = await readBucketsDetail();
  const keys = Object.keys(BUCKET_LABELS);
  return card({
    domain: 'finance',
    headline: 'How the banks total is split — pick a bank first to move money in or out',
    fields: [
      ...keys.map((k) => [BUCKET_LABELS[k], formatEGP(buckets[k] || 0)]),
      ['Future fund', `${formatEGP(future.total)} · cash + gold + Thndr`],
    ],
    buttons: [[button('finance:home', 'Back')]],
  });
}

/** A deposit/withdraw moves real bank money; the bucket is an optional tag on the same movement. */
export function bucketChoiceView(action, bankKey) {
  const keys = Object.keys(BUCKET_LABELS);
  const verb = action === 'deposit' ? 'Deposit to' : 'Withdraw from';
  return card({
    domain: 'finance', headline: `${verb} ${BANK_LABELS[bankKey]} — tag it to a bucket? (optional)`,
    buttons: [
      keys.map((k) => button(`finance:amount:${action}:${bankKey}:${k}`, BUCKET_LABELS[k])),
      [button(`finance:amount:${action}:${bankKey}:none`, 'No Bucket'), button(`finance:bank:${bankKey}`, 'Back')],
    ],
  });
}

/** The amount form; `meta` is handed back on submit (and carries the message to update afterwards). */
export function amountModal({ action, bankKey, bucketKey, responseUrl, expireKey }) {
  const title = bucketKey === 'none'
    ? `${BANK_LABELS[bankKey]} · ${action === 'deposit' ? 'Deposit' : 'Withdraw'}`
    : `${BANK_LABELS[bankKey]} → ${BUCKET_LABELS[bucketKey]}`;
  return {
    type: 'modal',
    callback_id: 'finance:modal',
    private_metadata: JSON.stringify({ action, bankKey, bucketKey, responseUrl, expireKey }),
    title: text(title.slice(0, 24)),
    submit: text('Save'),
    close: text('Cancel'),
    blocks: [{
      type: 'input',
      block_id: 'amount',
      label: text(`${action === 'deposit' ? 'Deposit' : 'Withdraw'} amount (EGP)`),
      element: { type: 'plain_text_input', action_id: 'value', placeholder: text('500') },
    }],
  };
}
