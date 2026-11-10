// Writes the emails to HTML files you can open in a browser, with the logo inlined: `npm run mail:preview [folder]`.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { invitationEmail, tasksAssignedEmail } from '../src/lib/emailTemplate.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] || path.join(here, '..', 'mail-preview'));
const MIME = { jpg: 'image/jpeg', gif: 'image/gif', png: 'image/png' };
/** The email's HTML with its pictures inlined, so a browser can show it. */
const inline = (mail) => mail.attachments.reduce((html, a) => {
  const bytes = a.file ? fs.readFileSync(path.join(here, '..', 'assets', 'mail', a.file)) : a.content;
  return html.replaceAll(`cid:${a.cid}"`, `data:${MIME[(a.file || a.filename).split('.').pop()]};base64,${bytes.toString("base64")}"`);
}, mail.html);
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
  fs.writeFileSync(path.join(out, `${name}.html`), inline(mail));
  console.log(`${name}: ${mail.subject}`);
}
console.log(`Written to ${out}`);
