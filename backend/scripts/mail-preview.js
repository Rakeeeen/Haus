// Writes the emails to HTML files you can open in a browser, with the logo inlined: `npm run mail:preview [folder]`.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MARK_CID, invitationEmail, tasksAssignedEmail } from '../src/lib/emailTemplate.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] || path.join(here, '..', 'mail-preview'));
const mark = `data:image/png;base64,${fs.readFileSync(path.join(here, '..', 'assets', 'mark.png')).toString('base64')}`;
const appUrl = 'https://rakeeen-uxdesign.github.io/Haus/';

const task = { title: 'Send the revised brand guidelines', description: 'Include the new colour tokens and the icon rules we agreed on, then share the link in the project.', date: '2026-11-12', endDate: '2026-11-14', priority: 'high' };
const samples = {
  invitation: invitationEmail({ inviter: 'Hamed', name: 'Sara Ahmed', email: 'sara@example.com', appUrl }),
  task: tasksAssignedEmail({ giver: 'Hamed', name: 'Sara Ahmed', items: [{ task, projectName: 'Brand refresh' }], appUrl }),
  tasks: tasksAssignedEmail({ giver: 'Hamed', name: 'Sara Ahmed', appUrl, items: [
    { task, projectName: 'Brand refresh' },
    { task: { title: 'مراجعة النصوص العربية', date: '2026-11-15' }, projectName: null },
    { task: { title: 'Book the studio', date: '2026-11-18', endDate: null }, projectName: 'Shoot' },
  ] }),
};

fs.mkdirSync(out, { recursive: true });
for (const [name, mail] of Object.entries(samples)) {
  fs.writeFileSync(path.join(out, `${name}.html`), mail.html.replaceAll(`cid:${MARK_CID}`, mark));
  console.log(`${name}: ${mail.subject}`);
}
console.log(`Written to ${out}`);
