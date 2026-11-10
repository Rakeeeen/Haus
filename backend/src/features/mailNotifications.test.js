import { describe, expect, it } from 'vitest';
import { assigneesOf, invitationToMail, isOpenTask, newlyGivenTo } from './mailNotifications.js';
import { mailConfig } from '../lib/mailer.js';

const NOW = Date.parse('2026-11-10T12:00:00Z');

describe('invitationToMail', () => {
  const member = { email: 'a@b.co', active: true, addedAt: '2026-11-10T11:58:00Z' };
  it('mails a fresh, active invitation once, under an id of its own', () => {
    expect(invitationToMail(member, NOW)).toBe('invite:a@b.co:2026-11-10T11:58:00Z');
  });
  it('a new invitation of the same person is a new id', () => {
    expect(invitationToMail({ ...member, addedAt: '2026-11-10T11:59:00Z' }, NOW)).not.toBe(invitationToMail(member, NOW));
  });
  it('skips one that is off, old, or incomplete', () => {
    expect(invitationToMail({ ...member, active: false }, NOW)).toBeNull();
    expect(invitationToMail({ ...member, addedAt: '2026-11-10T11:00:00Z' }, NOW)).toBeNull();
    expect(invitationToMail({ ...member, addedAt: undefined }, NOW)).toBeNull();
    expect(invitationToMail(null, NOW)).toBeNull();
  });
});

describe('who a task is given to', () => {
  it('reads the list, falls back to the single assignee, and to Hamed', () => {
    expect(assigneesOf({ assigneeUids: ['owner', 'g1'] })).toEqual(['owner', 'g1']);
    expect(assigneesOf({ assigneeUid: 'g1' })).toEqual(['g1']);
    expect(assigneesOf({})).toEqual(['owner']);
  });
  it('finds only the guests newly added', () => {
    expect(newlyGivenTo(['owner'], { assigneeUids: ['owner', 'g1'] })).toEqual(['g1']);
    expect(newlyGivenTo(['g1'], { assigneeUids: ['g1', 'g2'] })).toEqual(['g2']);
    expect(newlyGivenTo(['g1'], { assigneeUids: ['g1'] })).toEqual([]);
  });
  it('treats a new task as given to all its guests, but never to Hamed', () => {
    expect(newlyGivenTo(undefined, { assigneeUids: ['owner', 'g1'] })).toEqual(['g1']);
    expect(newlyGivenTo(undefined, { assigneeUids: ['owner'] })).toEqual([]);
  });
  it('does not tell a guest about a task they made themself', () => {
    expect(newlyGivenTo(undefined, { assigneeUids: ['g1'], createdByUid: 'g1' })).toEqual([]);
  });
  it('knows which tasks are still open', () => {
    expect(isOpenTask({ status: 'todo' })).toBe(true);
    expect(isOpenTask({ status: 'done' })).toBe(false);
    expect(isOpenTask({ status: 'dropped' })).toBe(false);
  });
});

describe('mailConfig', () => {
  it('is off without an account', () => {
    expect(mailConfig({})).toBeNull();
    expect(mailConfig({ MAIL_USER: 'me@gmail.com' })).toBeNull();
  });
  it('fills in Gmail by default, and drops the spaces Google puts in an app password', () => {
    const c = mailConfig({ MAIL_USER: 'me@gmail.com', MAIL_PASSWORD: 'abcd efgh ijkl mnop' });
    expect(c).toMatchObject({ host: 'smtp.gmail.com', port: 465, secure: true, from: 'Haus <me@gmail.com>', ownerName: 'حامد' });
    expect(c.auth.pass).toBe('abcdefghijklmnop');
  });
});
