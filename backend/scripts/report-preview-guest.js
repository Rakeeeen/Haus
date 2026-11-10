// Renders each guest's report to a local PDF and prints the numbers it is made of — nothing is sent to Discord.
//   node scripts/report-preview-guest.js [folder]   (default: the system temp folder)
import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildGuestReport, collectGuestRaw, reportRecipients } from '../src/features/report/guest.js';
import { renderGuestReportPdf } from '../src/features/report/render.js';

const folder = process.argv[2] || os.tmpdir();
const now = new Date();
for (const person of await reportRecipients()) {
  const raw = await collectGuestRaw(person.uid);
  const report = buildGuestReport(raw, person, now);
  const file = path.join(folder, `haus-report-preview-${person.uid}.pdf`);
  fs.writeFileSync(file, await renderGuestReportPdf(report));
  console.log(`\n${person.name} (${person.uid.slice(0, 6)}…) → ${file}`);
  console.log(`  raw:    glasses=${JSON.stringify(raw.glasses)}  tasks assigned=${raw.tasks.length}  pomodoro_week=${Array.isArray(raw.pomodoroWeek) ? 'yes' : 'no'}`);
  console.log(`  report: water ${report.water.glasses}/${report.water.goal} · focus ${report.focus.minutes}m in ${report.focus.sessions} sessions · done ${report.tasks.doneCount} · open ${report.tasks.openCount} · late ${report.tasks.lateCount}`);
  console.log(report.highlights.map((h) => `    [${h.tone}] ${h.text}`).join('\n'));
}
process.exit(0);
