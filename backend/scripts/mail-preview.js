// Writes the emails to HTML files you can open in a browser, with the logo inlined: `npm run mail:preview [folder]`.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cidOf, invitationEmail, tasksAssignedEmail } from '../src/lib/emailTemplate.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] || path.join(here, '..', 'mail-preview'));
const MIME = { jpg: 'image/jpeg', gif: 'image/gif', png: 'image/png' };
const inline = (html, images) => images.reduce((h, file) => h.replaceAll(`cid:${cidOf(file)}`, `data:${MIME[file.split('.').pop()]};base64,${fs.readFileSync(path.join(here, '..', 'assets', 'mail', file)).toString('base64')}`), html);
const appUrl = 'https://rakeeen-uxdesign.github.io/Haus/';

const task = { title: 'إرسال دليل الهوية البصرية المعدّل', description: 'مع ألوان الهوية الجديدة وقواعد الأيقونات التي اتفقنا عليها، ثم مشاركة الرابط في المشروع.', date: '2026-11-12', endDate: '2026-11-14', priority: 'high' };
const samples = {
  invitation: invitationEmail({ inviter: 'حامد', name: 'سارة أحمد', email: 'sara@example.com', appUrl }),
  task: tasksAssignedEmail({ giver: 'حامد', name: 'سارة أحمد', items: [{ task, projectName: 'تجديد الهوية' }], appUrl }),
  tasks: tasksAssignedEmail({ giver: 'حامد', name: 'سارة أحمد', appUrl, items: [
    { task, projectName: 'تجديد الهوية' },
    { task: { title: 'Review the English copy', date: '2026-11-15' }, projectName: null },
    { task: { title: 'حجز الاستوديو', date: '2026-11-18', endDate: null }, projectName: 'التصوير' },
  ] }),
};

fs.mkdirSync(out, { recursive: true });
for (const [name, mail] of Object.entries(samples)) {
  fs.writeFileSync(path.join(out, `${name}.html`), inline(mail.html, mail.images));
  console.log(`${name}: ${mail.subject}`);
}
console.log(`Written to ${out}`);
