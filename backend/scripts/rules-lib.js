// Shared by deploy-rules.js and test-rules.js: the service account the bot already uses, and the rules file.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert, getApp } from 'firebase-admin/app';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const RULES_PATH = path.join(HERE, '..', '..', 'firestore.rules');
export const PROJECT_ID = 'rakeeen-home';

export function init() {
  const key = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'serviceAccountKey.json'), 'utf8'));
  try { return getApp(); } catch { return initializeApp({ credential: cert(key) }); }
}

export const readRules = () => fs.readFileSync(RULES_PATH, 'utf8');
