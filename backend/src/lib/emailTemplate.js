import { NAME } from './brand.js';

// The emails Haus sends — an invitation, and a task given to someone. They are drawn in the system's own
// language: the silver page, a paper card with a hairline border and rounded corners, mono capitals for the
// small labels, one fully round ink button, and a row of pixels at the foot (the clock's). Email clients ignore
// most CSS, so this is plain tables with inline styles; the dark scheme is a media query for the clients that
// honour it (Apple Mail, iOS, Outlook.com) and simply stays silver in the rest.
//
// Everything here is pure: text in, `{ subject, html, text }` out. Anything that came from a person (a name, a
// task title) goes through `esc`, so it can never become markup.

const PALETTE = {
  page: '#D6D6D6', card: '#F2F2F2', ink: '#141413', faded: '#666666', line: '#D4D4D4', rust: '#B7410E',
};
const SANS = "'General Sans','Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "'Geist Mono','SF Mono',Menlo,Consolas,monospace";

/** The id the logo is attached under (`<img src="cid:…">`); the sender attaches `assets/mark.png` with it. */
export const MARK_CID = 'haus-mark';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** One line: for a subject, where a line break would be an injected header. */
const oneLine = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const PRIORITY = { low: 'Low', medium: 'Medium', high: 'High' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2026-11-12" → "Thu, 12 Nov"; anything else is shown as it is. */
export function prettyDay(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day ?? '');
  if (!m) return day ?? '';
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${DAYS[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** When a task is for: "Thu, 12 Nov", "Thu, 12 Nov → Sat, 14 Nov", or null. */
export function whenOf(task) {
  if (!task.date) return task.endDate ? prettyDay(task.endDate) : null;
  return task.endDate && task.endDate !== task.date ? `${prettyDay(task.date)} → ${prettyDay(task.endDate)}` : prettyDay(task.date);
}

/** The first `max` characters of some text, cut at a word where it can be, with an ellipsis. */
export function snippet(text, max = 220) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

const label = (text) =>
  `<span class="mute" style="font-family:${MONO};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${PALETTE.faded};">${esc(text)}</span>`;

/** The silver-ink pill, as round as every button in the app. */
const button = (href, text) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td class="btn" align="center" bgcolor="${PALETTE.ink}" style="background:${PALETTE.ink};border-radius:999px;">
    <a href="${esc(href)}" class="btn-a" style="display:inline-block;padding:14px 30px;font-family:${MONO};font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${PALETTE.card};text-decoration:none;border-radius:999px;">${esc(text)}</a>
  </td></tr></table>`;

/** A row of small squares — the pixel clock's grain. */
const pixels = () => {
  const cell = (on) => `<td width="6" height="6" style="width:6px;height:6px;font-size:0;line-height:0;background:${on ? PALETTE.ink : '#B4B4B4'};" class="${on ? 'px-on' : 'px-off'}">&nbsp;</td><td width="4" style="width:4px;font-size:0;">&nbsp;</td>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${[1, 0, 1, 1, 0, 1, 0, 0].map(cell).join('')}</tr></table>`;
};

/** A line of the details card: a small capital label over its value. */
const detail = (name, value, first = false) => `
  <tr><td class="rule" style="padding:14px 0 ${first ? '0' : '0'};${first ? '' : `border-top:1px solid ${PALETTE.line};`}">
    ${label(name)}<br />
    <span dir="auto" style="font-family:${SANS};font-size:16px;font-weight:600;color:${PALETTE.ink};line-height:1.5;" class="ink">${esc(value)}</span>
  </td></tr>`;

/** The page every email sits on. `body` is the card's content. */
function frame({ preheader, eyebrow, title, body }) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${esc(title)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .page { background:#0A0A0A !important; }
    .card { background:#000000 !important; border-color:#2A2A2A !important; }
    .ink, .ink a { color:#EDEDED !important; }
    .mute { color:#9A9A9A !important; }
    .rule { border-color:#2A2A2A !important; }
    .box { background:#0A0A0A !important; border-color:#2A2A2A !important; }
    .btn { background:#EDEDED !important; }
    .btn-a { color:#0A0A0A !important; background:#EDEDED !important; }
    .px-on { background:#EDEDED !important; }
    .px-off { background:#2A2A2A !important; }
  }
  @media (max-width: 480px) { .pad { padding:28px 22px !important; } .h1 { font-size:28px !important; } }
</style>
</head>
<body class="page" style="margin:0;padding:0;background:${PALETTE.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="page" style="background:${PALETTE.page};"><tr><td align="center" style="padding:40px 16px;">
  <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px;">
    <tr><td style="padding:0 4px 18px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;"><img src="cid:${MARK_CID}" width="36" height="36" alt="${esc(NAME)}" style="display:block;border:0;border-radius:10px;" /></td>
        <td style="vertical-align:middle;padding-left:12px;font-family:${MONO};font-size:12px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:${PALETTE.ink};" class="ink">${esc(NAME)}</td>
      </tr></table>
    </td></tr>
    <tr><td class="card pad" style="background:${PALETTE.card};border:1px solid ${PALETTE.line};border-radius:16px;padding:36px 34px;">
      <div style="margin-bottom:14px;">${label(eyebrow)}</div>
      <h1 class="h1 ink" dir="auto" style="margin:0 0 18px;font-family:${SANS};font-size:32px;line-height:1.15;font-weight:700;letter-spacing:-0.01em;color:${PALETTE.ink};">${esc(title)}</h1>
      ${body}
    </td></tr>
    <tr><td style="padding:22px 4px 0;">
      ${pixels()}
      <p class="mute" style="margin:14px 0 0;font-family:${MONO};font-size:11px;line-height:1.7;letter-spacing:0.04em;color:${PALETTE.faded};">
        Sent by ${esc(NAME)} because someone you know added you. If this wasn't meant for you, just ignore it.
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

const paragraph = (text) =>
  `<p class="ink" dir="auto" style="margin:0 0 22px;font-family:${SANS};font-size:16px;line-height:1.65;color:${PALETTE.ink};">${text}</p>`;

/**
 * The invitation: who invited them, the Google account to sign in with, and how the code works.
 * `inviter` is who is inviting (Hamed); `name` the guest's, if known.
 */
export function invitationEmail({ inviter, name, email, appUrl }) {
  const who = oneLine(inviter) || 'Someone';
  const hello = oneLine(name) ? `Hi ${esc(oneLine(name).split(' ')[0])}, ` : '';
  const body = `
    ${paragraph(`${hello}${esc(who)} added you to ${esc(NAME)} as a guest — a calm place for water, focus and time, with the projects and tasks shared with you.`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="box" style="background:#FFFFFF;border:1px solid ${PALETTE.line};border-radius:12px;margin:0 0 26px;"><tr><td style="padding:6px 20px 18px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${detail('Sign in with', email, true)}
        ${detail('Then', `${who} gives you a one-time code to let you in`)}
      </table>
    </td></tr></table>
    ${button(appUrl, `Open ${NAME}`)}`;
  return {
    subject: `${who} invited you to ${NAME}`,
    html: frame({ preheader: `Sign in with ${email} to get started.`, eyebrow: "You're invited", title: `Welcome to ${NAME}`, body }),
    text: [
      `${who} invited you to ${NAME}.`,
      '',
      `Sign in with the Google account ${email} at ${appUrl}`,
      `Then ${who} gives you a one-time code to let you in.`,
    ].join('\n'),
  };
}

/** The most tasks listed in one email; the rest are counted. */
export const MAX_LISTED = 8;

/** A task as the details card shows it. */
function taskCard(task, projectName, first = true) {
  const rows = [];
  const when = whenOf(task);
  if (projectName) rows.push(['Project', projectName]);
  if (when) rows.push([task.endDate && task.date && task.endDate !== task.date ? 'When' : 'Due', when]);
  if (task.priority && PRIORITY[task.priority]) rows.push(['Priority', PRIORITY[task.priority]]);
  const note = snippet(task.description);
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="box" style="background:#FFFFFF;border:1px solid ${PALETTE.line};border-radius:12px;margin:0 0 ${first ? '26' : '12'}px;"><tr><td style="padding:18px 20px 16px;">
      <div dir="auto" class="ink" style="font-family:${SANS};font-size:18px;font-weight:700;line-height:1.4;color:${PALETTE.ink};">${esc(task.title || 'Untitled')}</div>
      ${note ? `<div dir="auto" class="mute" style="margin-top:8px;font-family:${SANS};font-size:14px;line-height:1.6;color:${PALETTE.faded};">${esc(note)}</div>` : ''}
      ${rows.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">${rows.map(([k, v], i) => detail(k, v, i === 0)).join('')}</table>` : ''}
    </td></tr></table>`;
}

/**
 * Tasks given to someone: one gets its own card with the details; several (an import, a busy minute) arrive as one
 * email with a short list, so nobody's inbox fills up. `items` is `[{ task, projectName }]`.
 */
export function tasksAssignedEmail({ giver, name, items, appUrl }) {
  const who = oneLine(giver) || 'Someone';
  const hello = oneLine(name) ? `Hi ${esc(oneLine(name).split(' ')[0])}, ` : '';
  const many = items.length > 1;
  const first = items[0];

  const intro = many
    ? `${hello}${esc(who)} gave you ${items.length} new tasks.`
    : `${hello}${esc(who)} gave you a new task.`;
  const shown = items.slice(0, MAX_LISTED);
  const cards = many
    ? shown.map((item) => taskListLine(item.task, item.projectName)).join('') + (items.length > shown.length ? `<p class="mute" style="margin:6px 0 22px;font-family:${MONO};font-size:12px;color:${PALETTE.faded};">and ${items.length - shown.length} more</p>` : '')
    : taskCard(first.task, first.projectName);

  const body = `${paragraph(intro)}${many ? `<div style="margin:0 0 22px;">${cards}</div>` : cards}${button(appUrl, many ? 'Open my tasks' : 'Open task')}`;
  const title = many ? `${items.length} new tasks for you` : oneLine(first.task.title) || 'A new task';
  return {
    subject: many ? `${who} gave you ${items.length} new tasks` : `New task: ${oneLine(first.task.title) || 'Untitled'}`,
    html: frame({ preheader: many ? `${who} gave you ${items.length} new tasks.` : `${who} gave you a task.`, eyebrow: many ? 'New tasks' : 'New task for you', title, body }),
    text: [
      many ? `${who} gave you ${items.length} new tasks:` : `${who} gave you a new task:`,
      '',
      ...shown.map(({ task, projectName }) => `• ${oneLine(task.title) || 'Untitled'}${projectName ? ` (${projectName})` : ''}${whenOf(task) ? ` — ${whenOf(task)}` : ''}`),
      ...(items.length > shown.length ? [`… and ${items.length - shown.length} more`] : []),
      '',
      appUrl,
    ].join('\n'),
  };
}

/** One task in a list of several: its title, and what it is for / when, on a hairline row. */
function taskListLine(task, projectName) {
  const sub = [projectName, whenOf(task)].filter(Boolean).join('  ·  ');
  return `
    <div class="rule" style="padding:12px 0;border-top:1px solid ${PALETTE.line};">
      <div dir="auto" class="ink" style="font-family:${SANS};font-size:16px;font-weight:600;line-height:1.4;color:${PALETTE.ink};">${esc(task.title || 'Untitled')}</div>
      ${sub ? `<div dir="auto" class="mute" style="margin-top:3px;font-family:${MONO};font-size:11px;letter-spacing:0.06em;color:${PALETTE.faded};">${esc(sub)}</div>` : ''}
    </div>`;
}
