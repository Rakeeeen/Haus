// Reads a Notion export (Markdown & CSV) into the shapes Haus keeps projects, tasks and notes in. Pure: no files, no
// Firestore — scripts/import-notion.js does the reading and writing. Tested from the root `npm run test:run`.
import { createHash } from 'crypto';

/** RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes. Returns rows of strings. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell !== ''));
}

/** CSV text → one object per row, keyed by the header. */
export function csvObjects(text) {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  return rows.map((row) => Object.fromEntries(header.map((name, i) => [name.trim(), (row[i] ?? '').trim()])));
}

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  'يناير': 1, 'فبراير': 2, 'مارس': 3, 'أبريل': 4, 'ابريل': 4, 'مايو': 5, 'يونيو': 6, 'يوليو': 7, 'أغسطس': 8, 'اغسطس': 8,
  'سبتمبر': 9, 'أكتوبر': 10, 'اكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12,
};

const latinDigits = (s) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
const pad = (n) => String(n).padStart(2, '0');

/**
 * A Notion date cell → "YYYY-MM-DD" (the start, if it is a range), or null when it is empty or not understood.
 * Reads ISO ("2026-11-09"), English ("November 9, 2026", "Nov 9, 2026 3:32 PM") and Arabic ("9 نوفمبر 2026").
 */
export function parseNotionDate(cell) {
  if (!cell) return null;
  const text = latinDigits(cell).split(/→|->|—/)[0].trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dayFirst = text.match(/^(\d{1,2})\s+([^\d\s,]+)\s+(\d{4})/);
  if (dayFirst && MONTHS[dayFirst[2].toLowerCase()]) return `${dayFirst[3]}-${pad(MONTHS[dayFirst[2].toLowerCase()])}-${pad(Number(dayFirst[1]))}`;
  const monthFirst = text.match(/^([^\d\s,]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (monthFirst && MONTHS[monthFirst[1].toLowerCase()]) return `${monthFirst[3]}-${pad(MONTHS[monthFirst[1].toLowerCase()])}-${pad(Number(monthFirst[2]))}`;
  return null;
}

/** "Name (path or url), Other (path)" → ["Name", "Other"]. A plain value with no links comes back as it is. */
export function parseRelation(cell) {
  if (!cell) return [];
  const names = [];
  const re = /(.*?)\s*\((?:[^()]*)\)\s*(?:,\s*|$)/gs;
  let match;
  let consumed = 0;
  while ((match = re.exec(cell)) !== null && match[0] !== '') {
    const name = match[1].trim();
    if (name) names.push(name);
    consumed = re.lastIndex;
    if (consumed >= cell.length) break;
  }
  if (names.length === 0 && cell.trim()) return [cell.trim()];
  return names;
}

const norm = (s) => (s ?? '').replace(/[ً-ٰٟ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim().toLowerCase();

const TASK_STATUS = { 'لسه': 'todo', 'شغال': 'doing', 'خلصت': 'done', 'اترمت': 'dropped', 'not started': 'todo', 'to do': 'todo', 'todo': 'todo', 'in progress': 'doing', 'doing': 'doing', 'done': 'done', 'complete': 'done', 'dropped': 'dropped' };
const PROJECT_STATUS = {
  'تحت التشغيل': 'active', 'تحت التخطيط': 'planning', 'تحت الصيانه بعد العصريه': 'maintenance', 'على جنب': 'paused', 'علي جنب': 'paused', 'خلصت': 'done',
  'in progress': 'active', 'planning': 'planning', 'maintenance': 'maintenance', 'on hold': 'paused', 'done': 'done', 'completed': 'done',
};
const lookup = (table, value) => {
  const key = norm(value);
  const hit = Object.entries(table).find(([k]) => norm(k) === key);
  return hit ? hit[1] : null;
};

export const taskStatusOf = (value) => lookup(TASK_STATUS, value) ?? 'todo';
export const projectStatusOf = (value) => lookup(PROJECT_STATUS, value) ?? 'active';
export const priorityOf = (value) => ({ high: 'high', medium: 'medium', low: 'low' })[norm(value)] ?? null;

const hash = (text) => createHash('sha1').update(text).digest('hex').slice(0, 20);
const isoAt = (day) => (day ? `${day}T00:00:00.000Z` : new Date(0).toISOString());

/**
 * One Notion page (.md): the title, the "Key: value" property lines under it, and the body. The properties are
 * already in the CSV, so only the body is kept as the page's text.
 */
export function parsePage(markdown) {
  const lines = markdown.replace(/^﻿/, '').split(/\r?\n/);
  const title = (lines[0] ?? '').replace(/^#\s*/, '').trim();
  let i = 1;
  while (i < lines.length && lines[i].trim() === '') i++;
  const properties = {};
  while (i < lines.length) {
    const m = lines[i].match(/^([^:\n]{1,60}):\s?(.*)$/);
    if (!m) break;
    properties[m[1].trim()] = m[2].trim();
    i++;
  }
  return { title, properties, body: lines.slice(i).join('\n').trim() };
}

/**
 * Projects, tasks and notes ready to write. `pages` are the parsed .md pages of each database, used for text.
 * Returns what was understood and warnings for what was not (an unknown project name, a date that didn't parse).
 */
export function buildWork({ projectRows, taskRows, noteRows, taskPages = [], notePages = [], projectPages = [] }) {
  const warnings = [];
  const projects = [];
  const privates = [];
  const projectIdByName = new Map();

  for (const row of projectRows) {
    const name = row['اسم المشروع'] || row.Name || row.Title || '';
    if (!name) continue;
    const id = `p_${hash(norm(name))}`;
    projectIdByName.set(norm(name), id);
    const date = parseNotionDate(row['التاريخ']);
    if (row['التاريخ'] && !date) warnings.push(`Project "${name}": could not read the date "${row['التاريخ']}"`);
    projects.push({
      id, name, status: projectStatusOf(row.Status), priority: priorityOf(row['الضروره']),
      lead: (row.Lead || '').trim() || null, date, createdAt: isoAt(date), updatedAt: isoAt(date),
    });
    if (row.Tags) privates.push({ id, client: row.Tags.split(',')[0].trim() });
  }

  const taskPageByNo = new Map(taskPages.filter((p) => p.properties['Task ID']).map((p) => [String(p.properties['Task ID']).replace(/\D/g, ''), p]));
  const tasks = [];
  for (const row of taskRows) {
    const title = row['اسم المهمه'] || row.Name || row.Title || '';
    const noText = (row['Task ID'] || '').replace(/\D/g, '');
    if (!title && !noText) continue;
    const no = Number(noText) || tasks.length + 1;
    const date = parseNotionDate(row['التاريخ']);
    if (row['التاريخ'] && !date) warnings.push(`Task #${no}: could not read the date "${row['التاريخ']}"`);
    const created = parseNotionDate(row['Created time']) ?? date;
    const [projectName] = parseRelation(row['المشروع']);
    const projectId = projectName ? projectIdByName.get(norm(projectName)) ?? null : null;
    if (projectName && !projectId) warnings.push(`Task #${no}: no project named "${projectName}"`);
    const status = taskStatusOf(row['الحاله']);
    const page = taskPageByNo.get(String(no));
    tasks.push({
      id: `t_${no}`, no, title, status, priority: priorityOf(row['الضروره']), date, projectId,
      assignee: (row['ل مين ؟'] || '').trim() || null,
      tags: (row['بتاعة اي !'] || '').split(/[,،]/).map((t) => t.trim()).filter(Boolean),
      description: page?.body ?? '',
      createdAt: isoAt(created), updatedAt: isoAt(created), doneAt: status === 'done' ? isoAt(date ?? created) : null,
    });
  }

  const notes = [];
  const pageByTitle = new Map(notePages.map((p) => [norm(p.title), p]));
  for (const row of noteRows) {
    const title = row.Title || row.Name || '';
    if (!title) continue;
    const created = parseNotionDate(row['Created time']);
    const [projectName] = parseRelation(row.projects || row.Projects || '');
    const page = pageByTitle.get(norm(title));
    notes.push({
      id: `n_${hash(`${norm(title)}|${created ?? ''}`)}`, title, markdown: page?.body ?? '',
      projectId: projectName ? projectIdByName.get(norm(projectName)) ?? null : null,
      createdAt: isoAt(created), updatedAt: isoAt(parseNotionDate(row['Last edited time']) ?? created),
    });
  }

  // A project's own page text (a description), if it has one, goes on the project.
  for (const page of projectPages) {
    const id = projectIdByName.get(norm(page.title));
    const project = id && projects.find((p) => p.id === id);
    if (project && page.body) project.description = page.body;
  }

  return { projects, privates, tasks, notes, warnings };
}
