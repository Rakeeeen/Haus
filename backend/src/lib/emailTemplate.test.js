import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { IMAGE_FILES, MAX_LISTED, cidOf, esc, invitationEmail, prettyDay, snippet, tasksAssignedEmail, tasksPhrase, whenOf } from './emailTemplate.js';

const APP = 'https://example.com/Haus/';
const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'mail');

describe('small helpers', () => {
  it('escapes anything that could become markup', () => {
    expect(esc('<img src=x onerror="a()"> & \'q\'')).toBe('&lt;img src=x onerror=&quot;a()&quot;&gt; &amp; &#39;q&#39;');
    expect(esc(undefined)).toBe('');
  });
  it('writes a day in Arabic', () => {
    expect(prettyDay('2026-11-12')).toBe('الخميس 12 نوفمبر');
    expect(prettyDay('soon')).toBe('soon');
  });
  it('says when a task is for', () => {
    expect(whenOf({ date: '2026-11-12', endDate: null })).toBe('الخميس 12 نوفمبر');
    expect(whenOf({ date: '2026-11-12', endDate: '2026-11-12' })).toBe('الخميس 12 نوفمبر');
    expect(whenOf({ date: '2026-11-12', endDate: '2026-11-14' })).toBe('من الخميس 12 نوفمبر إلى السبت 14 نوفمبر');
    expect(whenOf({ date: null, endDate: null })).toBeNull();
  });
  it('counts tasks the way Arabic does', () => {
    expect(tasksPhrase(1)).toBe('مهمة جديدة');
    expect(tasksPhrase(2)).toBe('مهمتين جديدتين');
    expect(tasksPhrase(5)).toBe('5 مهام جديدة');
    expect(tasksPhrase(12)).toBe('12 مهمة جديدة');
  });
  it('cuts a long note at a word', () => {
    expect(snippet('short')).toBe('short');
    const cut = snippet('word '.repeat(100), 50);
    expect(cut.endsWith('…')).toBe(true);
    expect(cut.length).toBeLessThanOrEqual(51);
  });
});

describe('the pictures', () => {
  it('are all in assets/mail', () => {
    for (const file of IMAGE_FILES) expect(fs.existsSync(path.join(ASSETS, file)), file).toBe(true);
  });
  it('are named by cid without the extension', () => {
    expect(cidOf('hero-invitation.jpg')).toBe('hero-invitation');
  });
});

describe('invitationEmail', () => {
  const mail = invitationEmail({ inviter: 'حامد', name: 'Sara Ahmed', email: 'sara@example.com', appUrl: APP });
  it('is in Arabic, right to left, and says who invited', () => {
    expect(mail.subject).toBe('حامد دعاك إلى هاوس');
    expect(mail.html).toContain('lang="ar" dir="rtl"');
    expect(mail.html).toContain('أضافك <strong>حامد</strong>');
    expect(mail.html).toContain('Sara،');
  });
  it('names the account to sign in with, links to the app, and carries no code', () => {
    expect(mail.html).toContain('sara@example.com');
    expect(mail.html).toContain(`href="${APP}"`);
    expect(mail.text).not.toMatch(/\d{6,}/);
  });
  it('uses the hero, the lock, and the black logo, all attached', () => {
    for (const cid of ['hero-invitation', 'icon-lock', 'logo-black']) expect(mail.html).toContain(`cid:${cid}`);
    expect(mail.images).toEqual(['hero-invitation.jpg', 'icon-lock.gif', 'logo-black.png']);
  });
  it('is dark, and has no row of dots', () => {
    expect(mail.html).toContain('color-scheme" content="dark"');
    expect(mail.html).not.toContain('px-on');
  });
  it('works without a name', () => {
    expect(invitationEmail({ inviter: 'حامد', email: 'a@b.co', appUrl: APP }).html).toContain('أضافك <strong>حامد</strong>');
  });
  it('never lets a name become markup', () => {
    const evil = invitationEmail({ inviter: 'حامد', name: '<script>alert(1)</script>', email: 'a@b.co', appUrl: APP });
    expect(evil.html).not.toContain('<script>alert');
  });
});

describe('tasksAssignedEmail', () => {
  const task = { title: 'Send the guide', description: 'With the new tokens.', date: '2026-11-12', endDate: '2026-11-14', priority: 'high' };
  it('gives one task its own box with the details', () => {
    const mail = tasksAssignedEmail({ giver: 'حامد', name: 'Sara', items: [{ task, projectName: 'Brand refresh' }], appUrl: APP });
    expect(mail.subject).toBe('مهمة جديدة: Send the guide');
    expect(mail.html).toContain('Brand refresh');
    expect(mail.html).toContain('من الخميس 12 نوفمبر إلى السبت 14 نوفمبر');
    expect(mail.html).toContain('عالية');
    expect(mail.html).toContain('With the new tokens.');
    expect(mail.html).toContain('cid:hero-task');
    expect(mail.images).toContain('icon-tasks.gif');
    expect(mail.text).toContain('• Send the guide (Brand refresh)');
  });
  it('leaves out what a task does not have', () => {
    const mail = tasksAssignedEmail({ giver: 'حامد', name: 'Sara', items: [{ task: { title: 'Plain' }, projectName: null }], appUrl: APP });
    expect(mail.html).not.toContain('الأولوية');
    expect(mail.html).not.toContain('المشروع');
  });
  it('sends several as one email, and counts the ones it does not list', () => {
    const items = Array.from({ length: MAX_LISTED + 3 }, (_, i) => ({ task: { title: `Task ${i}` }, projectName: null }));
    const mail = tasksAssignedEmail({ giver: 'حامد', name: 'Sara', items, appUrl: APP });
    expect(mail.subject).toBe(`حامد أعطاك ${items.length} مهمة جديدة`);
    expect(mail.html).toContain('و3 أخرى');
    expect(mail.html).toContain('cid:hero-tasks');
    expect(mail.html).toContain('Task 0');
    expect(mail.html).not.toContain(`Task ${MAX_LISTED}<`);
  });
  it('keeps a subject on one line and a title from becoming markup', () => {
    const mail = tasksAssignedEmail({ giver: 'حامد', items: [{ task: { title: 'Line one\r\nBcc: x@y.z <b>' }, projectName: null }], appUrl: APP });
    expect(mail.subject).not.toMatch(/[\r\n]/);
    expect(mail.html).not.toContain('<b>');
  });
});
