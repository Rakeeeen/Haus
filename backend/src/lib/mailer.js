import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { MARK_CID } from './emailTemplate.js';
import { NAME } from './brand.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const MARK_PATH = path.join(here, '..', '..', 'assets', 'mark.png');

/**
 * The mail settings from the bot's .env: any SMTP account works. For Gmail, `MAIL_USER` is the address and
 * `MAIL_PASSWORD` an App Password (Google Account → Security → App passwords), not the account's own password.
 * Returns null when they are not filled in, and the bot simply doesn't send email.
 */
export function mailConfig(env = process.env) {
  const user = env.MAIL_USER?.trim();
  const pass = env.MAIL_PASSWORD?.replace(/\s+/g, '');
  if (!user || !pass) return null;
  const port = Number(env.MAIL_PORT || 465);
  return {
    host: env.MAIL_HOST?.trim() || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user, pass },
    from: env.MAIL_FROM?.trim() || `${NAME} <${user}>`,
    ownerName: env.OWNER_NAME?.trim() || 'Hamed',
    appUrl: env.APP_URL?.trim() || 'https://rakeeen-uxdesign.github.io/Haus/',
  };
}

/** A function that sends one `{ subject, html, text }` to an address, or null when email isn't set up. */
export function createMailer(config = mailConfig()) {
  if (!config) return null;
  const transport = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.secure, auth: config.auth });
  const mark = fs.existsSync(MARK_PATH) ? [{ filename: 'haus.png', path: MARK_PATH, cid: MARK_CID }] : [];
  return {
    config,
    send: ({ to, subject, html, text }) => transport.sendMail({ from: config.from, to, subject, html, text, attachments: mark }),
  };
}
