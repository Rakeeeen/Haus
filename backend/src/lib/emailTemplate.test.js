import { describe, expect, it } from 'vitest';
import { MARK_CID, MAX_LISTED, esc, invitationEmail, prettyDay, snippet, tasksAssignedEmail, whenOf } from './emailTemplate.js';

const APP = 'https://example.com/Haus/';

describe('small helpers', () => {
  it('escapes anything that could become markup', () => {
    expect(esc('<img src=x onerror="a()"> & \'q\'')).toBe('&lt;img src=x onerror=&quot;a()&quot;&gt; &amp; &#39;q&#39;');
    expect(esc(undefined)).toBe('');
  });
  it('writes a day the way the app does', () => {
    expect(prettyDay('2026-11-12')).toBe('Thu, 12 Nov');
    expect(prettyDay('soon')).toBe('soon');
  });
  it('says when a task is for', () => {
    expect(whenOf({ date: '2026-11-12', endDate: null })).toBe('Thu, 12 Nov');
    expect(whenOf({ date: '2026-11-12', endDate: '2026-11-12' })).toBe('Thu, 12 Nov');
    expect(whenOf({ date: '2026-11-12', endDate: '2026-11-14' })).toBe('Thu, 12 Nov → Sat, 14 Nov');
    expect(whenOf({ date: null, endDate: null })).toBeNull();
  });
  it('cuts a long note at a word', () => {
    expect(snippet('short')).toBe('short');
    const cut = snippet('word '.repeat(100), 50);
    expect(cut.endsWith('…')).toBe(true);
    expect(cut.length).toBeLessThanOrEqual(51);
  });
});

describe('invitationEmail', () => {
  const mail = invitationEmail({ inviter: 'Hamed', name: 'Sara Ahmed', email: 'sara@example.com', appUrl: APP });
  it('names who invited, the account to sign in with, and links to the app', () => {
    expect(mail.subject).toBe('Hamed invited you to Haus');
    expect(mail.html).toContain('Hi Sara, Hamed added you');
    expect(mail.html).toContain('sara@example.com');
    expect(mail.html).toContain(`href="${APP}"`);
    expect(mail.text).toContain(APP);
  });
  it('carries the logo as an attachment id, and a dark scheme', () => {
    expect(mail.html).toContain(`cid:${MARK_CID}`);
    expect(mail.html).toContain('prefers-color-scheme: dark');
  });
  it('works without a name', () => {
    expect(invitationEmail({ inviter: 'Hamed', email: 'a@b.co', appUrl: APP }).html).toContain('Hamed added you');
  });
  it('never lets a name become markup', () => {
    const evil = invitationEmail({ inviter: 'Hamed', name: '<script>alert(1)</script>', email: 'a@b.co', appUrl: APP });
    expect(evil.html).not.toContain('<script>alert');
  });
});

describe('tasksAssignedEmail', () => {
  const task = { title: 'Send the guide', description: 'With the new tokens.', date: '2026-11-12', endDate: '2026-11-14', priority: 'high' };
  it('gives one task its own card with the details', () => {
    const mail = tasksAssignedEmail({ giver: 'Hamed', name: 'Sara', items: [{ task, projectName: 'Brand refresh' }], appUrl: APP });
    expect(mail.subject).toBe('New task: Send the guide');
    expect(mail.html).toContain('Brand refresh');
    expect(mail.html).toContain('Thu, 12 Nov → Sat, 14 Nov');
    expect(mail.html).toContain('High');
    expect(mail.html).toContain('With the new tokens.');
    expect(mail.text).toContain('• Send the guide (Brand refresh)');
  });
  it('leaves out what a task does not have', () => {
    const mail = tasksAssignedEmail({ giver: 'Hamed', name: 'Sara', items: [{ task: { title: 'Plain' }, projectName: null }], appUrl: APP });
    expect(mail.html).not.toContain('Priority');
    expect(mail.html).not.toContain('Project');
  });
  it('sends several as one email, and counts the ones it does not list', () => {
    const items = Array.from({ length: MAX_LISTED + 3 }, (_, i) => ({ task: { title: `Task ${i}` }, projectName: null }));
    const mail = tasksAssignedEmail({ giver: 'Hamed', name: 'Sara', items, appUrl: APP });
    expect(mail.subject).toBe(`Hamed gave you ${items.length} new tasks`);
    expect(mail.html).toContain('and 3 more');
    expect(mail.html).toContain('Task 0');
    expect(mail.html).not.toContain(`Task ${MAX_LISTED}<`);
  });
  it('keeps a subject on one line and a title from becoming markup', () => {
    const mail = tasksAssignedEmail({ giver: 'Hamed', items: [{ task: { title: 'Line one\r\nBcc: x@y.z <b>' }, projectName: null }], appUrl: APP });
    expect(mail.subject).not.toMatch(/[\r\n]/);
    expect(mail.html).not.toContain('<b>');
  });
});
