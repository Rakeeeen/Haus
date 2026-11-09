// Publishes firestore.rules to the live project, using the bot's service account.
//   node backend/scripts/deploy-rules.js             publish (the ruleset being replaced is remembered)
//   node backend/scripts/deploy-rules.js --rollback  put the remembered ruleset back
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSecurityRules } from 'firebase-admin/security-rules';
import { init, readRules } from './rules-lib.js';

const REMEMBERED = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.rules-previous');

init();
const rules = getSecurityRules();

if (process.argv.includes('--rollback')) {
  if (!fs.existsSync(REMEMBERED)) { console.error('❌ Nothing to roll back to: no earlier ruleset was remembered.'); process.exit(1); }
  const name = fs.readFileSync(REMEMBERED, 'utf8').trim();
  await rules.releaseFirestoreRuleset(name);
  console.log(`↩️  Rolled back to ${name}`);
  process.exit(0);
}

const before = await rules.getFirestoreRuleset();
fs.writeFileSync(REMEMBERED, before.name);
// Creating the ruleset checks its syntax first, so a broken file is refused before anything is released.
const after = await rules.releaseFirestoreRulesetFromSource(readRules());
console.log(`✅ Published ${after.name}\n   (the one it replaced, ${before.name}, is remembered — run with --rollback to put it back)`);
process.exit(0);
