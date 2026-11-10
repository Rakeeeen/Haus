// Imports a Notion export (Markdown & CSV) into Haus: projects, their clients, tasks (with their text) and notes.
//   node backend/scripts/import-notion.js "<export folder>"           look only: says what it found, writes nothing
//   node backend/scripts/import-notion.js "<export folder>" --write   writes it
// Safe to run again: ids come from the export, and anything already in Haus is left as it is (your edits stay).
import fs from 'fs';
import path from 'path';
import { getFirestore } from 'firebase-admin/firestore';
import { init } from './rules-lib.js';
import { buildWork, csvObjects, parsePage } from '../src/lib/notionImport.js';

const folder = process.argv[2];
const write = process.argv.includes('--write');
if (!folder || !fs.existsSync(folder)) {
  console.error('Usage: node backend/scripts/import-notion.js "<export folder>" [--write]');
  process.exit(1);
}

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const files = walk(folder);
const rel = (f) => path.relative(folder, f);

/** The database's full CSV: the one named after it, "_all" first, the shallowest if several. */
function findCsv(name) {
  const mine = files.filter((f) => path.basename(f).startsWith(name) && f.endsWith('.csv'));
  const all = mine.filter((f) => f.endsWith('_all.csv'));
  const pool = all.length ? all : mine;
  return pool.sort((a, b) => rel(a).split(path.sep).length - rel(b).split(path.sep).length)[0] ?? null;
}

const read = (name) => {
  const file = findCsv(name);
  if (!file) { console.warn(`⚠️  No CSV found for "${name}"`); return []; }
  console.log(`📄 ${name}: ${rel(file)}`);
  return csvObjects(fs.readFileSync(file, 'utf8'));
};

const pages = files.filter((f) => f.endsWith('.md')).map((f) => ({ file: f, ...parsePage(fs.readFileSync(f, 'utf8')) }));
const inside = (f, name) => rel(f).split(path.sep).some((part) => part.startsWith(name));

const projectRows = read('المشاريع');
const taskRows = read('يوميتي');
const noteRows = read('الملاحظات');

const built = buildWork({
  projectRows, taskRows, noteRows,
  taskPages: pages.filter((p) => inside(p.file, 'يوميتي') && p.properties['الحاله']),
  notePages: pages.filter((p) => inside(p.file, 'الملاحظات')),
});

const count = (items, key) => items.reduce((acc, i) => ({ ...acc, [i[key] ?? 'none']: (acc[i[key] ?? 'none'] ?? 0) + 1 }), {});
console.log(`\nFound ${built.projects.length} projects, ${built.privates.length} clients, ${built.tasks.length} tasks, ${built.notes.length} notes.`);
console.log('  projects by status:', count(built.projects, 'status'));
console.log('  tasks by status:   ', count(built.tasks, 'status'));
console.log(`  tasks with text: ${built.tasks.filter((t) => t.description).length}, with a date: ${built.tasks.filter((t) => t.date).length}, with a project: ${built.tasks.filter((t) => t.projectId).length}`);
console.log(`  notes with text: ${built.notes.filter((n) => n.markdown).length}`);
if (built.warnings.length) {
  console.log(`\n⚠️  ${built.warnings.length} thing(s) not understood:`);
  built.warnings.slice(0, 15).forEach((w) => console.log('   -', w));
  if (built.warnings.length > 15) console.log(`   … and ${built.warnings.length - 15} more`);
}
console.log('\nSample tasks:');
built.tasks.slice(0, 3).forEach((t) => console.log(`   #${t.no} [${t.status}] ${t.date ?? 'no date'} — ${t.title}`));

if (!write) {
  console.log('\nNothing was written. Run again with --write to import.');
  process.exit(0);
}

init();
const db = getFirestore();
const plan = [
  ['work_projects', built.projects],
  ['work_projects_private', built.privates],
  ['work_tasks', built.tasks],
  ['work_notes', built.notes],
];
for (const [collection, items] of plan) {
  const existing = new Set((await db.collection(collection).select().get()).docs.map((d) => d.id));
  const fresh = items.filter((item) => !existing.has(item.id));
  for (let i = 0; i < fresh.length; i += 400) {
    const batch = db.batch();
    for (const { id, ...data } of fresh.slice(i, i + 400)) batch.set(db.collection(collection).doc(id), data);
    await batch.commit();
  }
  console.log(`✅ ${collection}: wrote ${fresh.length}, left ${items.length - fresh.length} already there`);
}
process.exit(0);
