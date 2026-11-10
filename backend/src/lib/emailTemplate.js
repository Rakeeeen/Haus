import { NAME } from './brand.js';

// The emails Haus sends — an invitation, and a task given to someone — in Arabic and in the system's dark side: a
// black card on a near-black page, a retro photograph with the words over it in Thmanyah (the app's own font), the
// purple call-to-action as a fully round button, and at the foot a silver band with the black house mark, the name,
// and one of the app's animated hand-drawn icons (a GIF of its line boil). Email clients ignore most CSS, so this is
// plain tables with inline styles. Pictures travel inside the message (`images`, attached by the mailer under their
// cid), so nothing depends on the website being online.
//
// Everything here is pure: text in, `{ subject, html, text, images }` out. Anything that came from a person (a name,
// a task title) goes through `esc`, so it can never become markup.

const C = {
  page: '#0A0A0A', card: '#000000', line: '#232323', box: '#0D0D0D', ink: '#EDEDED', faded: '#9A9A9A',
  purple: '#4D14A2', rust: '#E2583A', band: '#D6D6D6', bandInk: '#141413', bandFaded: '#5A5A5A',
};
const FONT = "'Thmanyah','Segoe UI','SF Arabic','Geeza Pro',Tahoma,Arial,sans-serif";
const NAME_AR = 'هاوس';
const MONO = "'Geist Mono','SF Mono',Menlo,Consolas,monospace";

// The app's own font files, for the clients that load fonts (Apple Mail, iOS). Gmail doesn't, and falls back to the
// system's Arabic face — which is why the headline is part of the picture.
const FONT_FACES = [[400, 'x6EBzvXf1Fi35XhsRoHxePDVo'], [700, 'oE98mOPE28KTzUeptOLRIaqW1I'], [900, 'ulQLGTktcl2Qq4AmD6RuVgELZKg']]
  .map(([weight, id]) => `@font-face{font-family:'Thmanyah';font-weight:${weight};src:url('https://framerusercontent.com/assets/${id}.woff2') format('woff2');}`)
  .join('');

/** The pictures the emails use: file in `backend/assets/mail`, and the cid it is attached under. */
export const IMAGE_FILES = ['hero-invitation.jpg', 'hero-task.jpg', 'hero-tasks.jpg', 'icon-lock.gif', 'icon-tasks.gif', 'logo-black.png'];
export const cidOf = (file) => file.replace(/\.[a-z]+$/, '');

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** One line: for a subject, where a line break would be an injected header. */
const oneLine = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const PRIORITY = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية' };
const PRIORITY_COLOR = { low: C.faded, medium: C.ink, high: C.rust };

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

/** "2026-11-12" → "الخميس 12 نوفمبر"; anything else is shown as it is. */
export function prettyDay(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day ?? '');
  if (!m) return day ?? '';
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${DAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** When a task is for: one day, "من … إلى …", or null. */
export function whenOf(task) {
  if (!task.date) return task.endDate ? prettyDay(task.endDate) : null;
  return task.endDate && task.endDate !== task.date ? `من ${prettyDay(task.date)} إلى ${prettyDay(task.endDate)}` : prettyDay(task.date);
}

/** "مهمة جديدة", "مهمتان جديدتان", "٣ مهام جديدة" — the count of tasks the way Arabic says it. */
export function tasksPhrase(count) {
  if (count === 1) return 'مهمة جديدة';
  if (count === 2) return 'مهمتين جديدتين';
  return count <= 10 ? `${count} مهام جديدة` : `${count} مهمة جديدة`;
}

/** The first `max` characters of some text, cut at a word where it can be, with an ellipsis. */
export function snippet(text, max = 220) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

const small = (text) =>
  `<span style="font-family:${FONT};font-size:12px;font-weight:700;color:${C.faded};letter-spacing:0.02em;">${esc(text)}</span>`;

/** The purple pill, as round as every button in the app. */
const button = (href, text) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${C.purple}" style="background:${C.purple};border-radius:999px;">
    <a href="${esc(href)}" style="display:block;padding:16px 28px;font-family:${FONT};font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:999px;">${esc(text)}</a>
  </td></tr></table>`;

/** A line of a details box: a small label over its value. `ltr` keeps an email address or a number the right way round. */
const detail = (name, value, { first = false, ltr = false, color = C.ink } = {}) => `
  <tr><td style="padding:${first ? '4px' : '14px'} 0 4px;${first ? '' : `border-top:1px solid ${C.line};`}">
    ${small(name)}<br />
    <span ${ltr ? 'dir="ltr" style="unicode-bidi:embed;text-align:right;display:block;' : 'dir="auto" style="'}font-family:${FONT};font-size:16px;font-weight:700;color:${color};line-height:1.7;">${esc(value)}</span>
  </td></tr>`;

const box = (inner, bottom = 24) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.box};border:1px solid ${C.line};border-radius:12px;margin:0 0 ${bottom}px;"><tr><td style="padding:18px 20px 16px;">${inner}</td></tr></table>`;

const paragraph = (text) =>
  `<p dir="rtl" style="margin:0 0 22px;font-family:${FONT};font-size:16px;line-height:1.9;color:${C.ink};">${text}</p>`;

/** The page every email sits on. `hero` is the picture over the card, `icon` the animated one in the footer. */
function frame({ title, preheader, hero, icon, body }) {
  return `<!doctype html>
<html lang="ar" dir="rtl"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>${esc(title)}</title>
<style>${FONT_FACES}@media (max-width:480px){.pad{padding:26px 22px !important;}}</style>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};"><tr><td align="center" style="padding:36px 16px;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:${C.card};border:1px solid ${C.line};border-radius:18px;border-collapse:separate;overflow:hidden;">
    <tr><td style="font-size:0;line-height:0;"><img src="cid:${cidOf(hero)}" width="560" alt="${esc(title)}" style="display:block;width:100%;height:auto;border:0;" /></td></tr>
    <tr><td class="pad" dir="rtl" style="padding:30px 34px 8px;text-align:right;">${body}</td></tr>
    <tr><td class="pad" dir="rtl" style="padding:0 34px 28px;text-align:right;">
      <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.9;color:${C.faded};">وصلتك هذه الرسالة لأن أحدًا أضافك في ${NAME_AR}. إن لم تكن أنت المقصود، تجاهلها ببساطة.</p>
    </td></tr>
    <tr><td style="background:${C.band};padding:18px 34px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl"><tr>
        <td align="right" style="vertical-align:middle;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" dir="rtl"><tr>
            <td style="vertical-align:middle;"><img src="cid:logo-black" width="40" height="40" alt="${esc(NAME)}" style="display:block;border:0;" /></td>
            <td style="vertical-align:middle;padding-right:12px;text-align:right;">
              <div style="font-family:${MONO};font-size:15px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${C.bandInk};">${esc(NAME)}</div>
              <div style="font-family:${FONT};font-size:13px;font-weight:700;color:${C.bandFaded};">هاوس</div>
            </td>
          </tr></table>
        </td>
        <td align="left" style="vertical-align:middle;"><img src="cid:${cidOf(icon)}" width="56" height="56" alt="" style="display:block;border:0;" /></td>
      </tr></table>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

/**
 * The invitation: who invited them, the Google account to sign in with, and a button. There is no code in it — the
 * inviter gives that in person. `inviter` is who is inviting; `name` the guest's, if known.
 */
export function invitationEmail({ inviter, name, email, appUrl }) {
  const who = oneLine(inviter) || 'شخص ما';
  const first = oneLine(name).split(' ')[0];
  const hello = first ? `${esc(first)}، ` : '';
  const body = `
    ${paragraph(`${hello}أضافك <strong>${esc(who)}</strong> كضيف في ${NAME_AR}: مساحة هادئة للمياه والتركيز والوقت، مع المشاريع والمهام التي تُشارَك معك.`)}
    ${box(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${detail('سجّل الدخول بحساب Google', email, { first: true, ltr: true })}
      ${detail('بعدها', `سيعطيك ${who} رمز دخول لمرة واحدة`)}
    </table>`)}
    ${button(appUrl, `ادخل إلى ${NAME_AR}`)}
    <div style="height:26px;line-height:26px;font-size:0;">&nbsp;</div>`;
  return {
    subject: `${who} دعاك إلى ${NAME_AR}`,
    html: frame({ title: `تمت دعوتك إلى ${NAME_AR}`, preheader: `سجّل الدخول بحساب ${email} للبدء.`, hero: 'hero-invitation.jpg', icon: 'icon-lock.gif', body }),
    text: [`${who} دعاك إلى ${NAME_AR}.`, '', `سجّل الدخول بحساب Google: ${email}`, appUrl, `بعدها سيعطيك ${who} رمز دخول لمرة واحدة.`].join('\n'),
    images: ['hero-invitation.jpg', 'icon-lock.gif', 'logo-black.png'],
  };
}

/** The most tasks listed in one email; the rest are counted. */
export const MAX_LISTED = 8;

/** A task as the details box shows it. */
function taskCard(task, projectName) {
  const rows = [];
  const when = whenOf(task);
  if (projectName) rows.push(['المشروع', projectName, {}]);
  if (when) rows.push([task.endDate && task.date && task.endDate !== task.date ? 'المدة' : 'الموعد', when, {}]);
  if (task.priority && PRIORITY[task.priority]) rows.push(['الأولوية', PRIORITY[task.priority], { color: PRIORITY_COLOR[task.priority] }]);
  const note = snippet(task.description);
  return box(`
    <div dir="auto" style="font-family:${FONT};font-size:19px;font-weight:700;line-height:1.6;color:${C.ink};">${esc(task.title || 'بدون عنوان')}</div>
    ${note ? `<div dir="auto" style="margin-top:6px;font-family:${FONT};font-size:14px;line-height:1.8;color:${C.faded};">${esc(note)}</div>` : ''}
    ${rows.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">${rows.map(([k, v, o], i) => detail(k, v, { first: i === 0, ...o })).join('')}</table>` : ''}`);
}

/** One task in a list of several: its title, and what it is for / when, on a hairline row. */
function taskLine(task, projectName) {
  const sub = [projectName, whenOf(task)].filter(Boolean).join('  ·  ');
  return `
    <div style="padding:12px 0;border-top:1px solid ${C.line};">
      <div dir="auto" style="font-family:${FONT};font-size:16px;font-weight:700;line-height:1.6;color:${C.ink};">${esc(task.title || 'بدون عنوان')}</div>
      ${sub ? `<div dir="auto" style="margin-top:2px;font-family:${FONT};font-size:13px;color:${C.faded};">${esc(sub)}</div>` : ''}
    </div>`;
}

/**
 * Tasks given to someone: one gets its own box with the details; several (an import, a busy minute) arrive as one email
 * with a short list, so nobody's inbox fills up. `items` is `[{ task, projectName }]`.
 */
export function tasksAssignedEmail({ giver, name, items, appUrl }) {
  const who = oneLine(giver) || 'شخص ما';
  const first = oneLine(name).split(' ')[0];
  const hello = first ? `${esc(first)}، ` : '';
  const many = items.length > 1;
  const shown = items.slice(0, MAX_LISTED);

  const intro = many ? `${hello}أعطاك <strong>${esc(who)}</strong> ${tasksPhrase(items.length)}.` : `${hello}أعطاك <strong>${esc(who)}</strong> مهمة جديدة.`;
  const listing = many
    ? `<div style="margin:0 0 22px;">${shown.map((i) => taskLine(i.task, i.projectName)).join('')}${items.length > shown.length ? `<p style="margin:8px 0 0;font-family:${FONT};font-size:13px;color:${C.faded};">و${items.length - shown.length} أخرى</p>` : ''}</div>`
    : taskCard(items[0].task, items[0].projectName);

  const body = `${paragraph(intro)}${listing}${button(appUrl, many ? 'افتح مهامي' : 'افتح المهمة')}<div style="height:26px;line-height:26px;font-size:0;">&nbsp;</div>`;
  const title = many ? tasksPhrase(items.length) : 'مهمة جديدة';
  const hero = many ? 'hero-tasks.jpg' : 'hero-task.jpg';
  return {
    subject: many ? `${who} أعطاك ${tasksPhrase(items.length)}` : `مهمة جديدة: ${oneLine(items[0].task.title) || 'بدون عنوان'}`,
    html: frame({ title, preheader: `${who} أعطاك ${many ? tasksPhrase(items.length) : 'مهمة'}.`, hero, icon: 'icon-tasks.gif', body }),
    text: [
      many ? `${who} أعطاك ${tasksPhrase(items.length)}:` : `${who} أعطاك مهمة جديدة:`,
      '',
      ...shown.map(({ task, projectName }) => `• ${oneLine(task.title) || 'بدون عنوان'}${projectName ? ` (${projectName})` : ''}${whenOf(task) ? ` — ${whenOf(task)}` : ''}`),
      ...(items.length > shown.length ? [`... و${items.length - shown.length} أخرى`] : []),
      '',
      appUrl,
    ].join('\n'),
    images: [hero, 'icon-tasks.gif', 'logo-black.png'],
  };
}
