import { describe, expect, it } from 'vitest';
import { actorOf, assigneesOf, cairoDay, cairoHour, daysBetween, deadlineOf, eventTime, invitationToMail, isOpenTask, newlyGiven, overdueBy, overdueKey, stillTold } from './mailNotifications.js';
import { mailConfig } from '../lib/mailer.js';

describe('invitationToMail', () => {
  const since = '2026-11-10T10:00:00Z';
  const member = { email: 'a@b.co', active: true, addedAt: '2026-11-10T11:58:00Z' };
  it('mails an active invitation made after the start, once, under an id of its own', () => {
    expect(invitationToMail(member, since)).toBe('invite:a@b.co:2026-11-10T11:58:00Z');
  });
  it('catches up on one made while the bot was off — it is only the start that counts', () => {
    expect(invitationToMail({ ...member, addedAt: '2026-11-12T08:00:00Z' }, since)).not.toBeNull();
  });
  it('a new invitation of the same person is a new id', () => {
    expect(invitationToMail({ ...member, addedAt: '2026-11-10T11:59:00Z' }, since)).not.toBe(invitationToMail(member, since));
  });
  it('skips one that is off, from before the start, or incomplete', () => {
    expect(invitationToMail({ ...member, active: false }, since)).toBeNull();
    expect(invitationToMail({ ...member, addedAt: '2026-11-09T11:00:00Z' }, since)).toBeNull();
    expect(invitationToMail({ ...member, addedAt: undefined }, since)).toBeNull();
    expect(invitationToMail(null, since)).toBeNull();
  });
});

describe('who a task is given to', () => {
  it('reads the list, falls back to the single assignee, and to Hamed', () => {
    expect(assigneesOf({ assigneeUids: ['owner', 'g1'] })).toEqual(['owner', 'g1']);
    expect(assigneesOf({ assigneeUid: 'g1' })).toEqual(['g1']);
    expect(assigneesOf({})).toEqual(['owner']);
  });
  it('finds whose doing a change was: the one who made a new task, the admin who stamped a change, else Hamed', () => {
    expect(actorOf({ createdByUid: 'g1' }, true)).toBe('g1');
    expect(actorOf({ createdByUid: null }, true)).toBe('owner');
    expect(actorOf({ createdByUid: 'g1', updatedByUid: 'g2' }, false)).toBe('g2');
    expect(actorOf({ createdByUid: 'g1', updatedByUid: null }, false)).toBe('owner');
    expect(actorOf({ createdByUid: 'g1' }, false)).toBe('owner');
  });
  it('takes the time of a new task from when it was made and of a change from when it was changed', () => {
    const task = { createdAt: '2026-11-10T08:00:00Z', updatedAt: '2026-11-10T09:00:00Z' };
    expect(eventTime(task, true)).toBe('2026-11-10T08:00:00Z');
    expect(eventTime(task, false)).toBe('2026-11-10T09:00:00Z');
    expect(eventTime({}, false)).toBeNull();
  });
  it('finds only those newly given, never the one who did it', () => {
    expect(newlyGiven(['owner'], { assigneeUids: ['owner', 'g1'] }, 'owner')).toEqual(['g1']);
    expect(newlyGiven(['g1'], { assigneeUids: ['g1', 'g2'] }, 'owner')).toEqual(['g2']);
    expect(newlyGiven(['g1'], { assigneeUids: ['g1'] }, 'owner')).toEqual([]);
    expect(newlyGiven(undefined, { assigneeUids: ['g1'] }, 'g1')).toEqual([]);
  });
  it('treats a task the bot has not met as given to all its people, Hamed included when a guest gave it to him', () => {
    expect(newlyGiven(undefined, { assigneeUids: ['owner', 'g1'] }, 'g2')).toEqual(['owner', 'g1']);
    expect(newlyGiven(undefined, { assigneeUids: ['owner'] }, 'owner')).toEqual([]);
  });
  it('tells someone again when they were taken off and put back', () => {
    const told = ['g1', 'g2'];
    expect(stillTold(told, { assigneeUids: ['g1'] })).toEqual(['g1']);
    expect(newlyGiven(stillTold(told, { assigneeUids: ['g1'] }), { assigneeUids: ['g1', 'g2'] }, 'owner')).toEqual(['g2']);
  });
  it('knows which tasks are still open', () => {
    expect(isOpenTask({ status: 'todo' })).toBe(true);
    expect(isOpenTask({ status: 'done' })).toBe(false);
    expect(isOpenTask({ status: 'dropped' })).toBe(false);
  });
});

describe('overdue', () => {
  const t = (over) => ({ id: 't', status: 'todo', date: '2026-11-10', endDate: null, ...over });
  it('takes a task\'s last day from its end, or its day', () => {
    expect(deadlineOf(t({ endDate: '2026-11-14' }))).toBe('2026-11-14');
    expect(deadlineOf(t({}))).toBe('2026-11-10');
    expect(deadlineOf(t({ date: null }))).toBeNull();
    expect(deadlineOf(t({ endDate: '2026-11-08' }))).toBe('2026-11-10'); // an end before the start counts for nothing
  });
  it('knows today and the hour in Cairo', () => {
    expect(cairoDay(new Date('2026-11-11T22:30:00Z'))).toBe('2026-11-12');
    expect(cairoHour(new Date('2026-11-11T22:30:00Z'))).toBe(0);
    expect(cairoHour(new Date('2026-11-12T07:00:00Z'))).toBe(9);
  });
  it('counts days between two dates', () => {
    expect(daysBetween('2026-11-10', '2026-11-12')).toBe(2);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  });
  it('is how many days late an open task is once its last day has passed', () => {
    expect(overdueBy(t({}), '2026-11-11', '2026-11-01')).toBe(1);
    expect(overdueBy(t({}), '2026-11-15', '2026-11-01')).toBe(5);
    expect(overdueBy(t({}), '2026-11-10', '2026-11-01')).toBeNull(); // its last day is today
    expect(overdueBy(t({ status: 'done' }), '2026-11-15', '2026-11-01')).toBeNull();
    expect(overdueBy(t({ status: 'dropped' }), '2026-11-15', '2026-11-01')).toBeNull();
    expect(overdueBy(t({ date: null }), '2026-11-15', '2026-11-01')).toBeNull();
    expect(overdueBy(t({}), '2026-11-15', '2026-11-12')).toBeNull(); // was already late before the start
  });
  it('is told once per task, last day and person', () => {
    expect(overdueKey(t({}), 'g1')).toBe('overdue:t:2026-11-10:g1');
    expect(overdueKey(t({ endDate: '2026-11-12' }), 'g1')).not.toBe(overdueKey(t({}), 'g1')); // a moved end is a new notice
    expect(overdueKey(t({}), 'g2')).not.toBe(overdueKey(t({}), 'g1'));
  });
});

describe('mailConfig', () => {
  it('is off without an account', () => {
    expect(mailConfig({})).toBeNull();
    expect(mailConfig({ MAIL_USER: 'me@gmail.com' })).toBeNull();
  });
  it('fills in Gmail by default, and drops the spaces Google puts in an app password', () => {
    const c = mailConfig({ MAIL_USER: 'me@gmail.com', MAIL_PASSWORD: 'abcd efgh ijkl mnop' });
    expect(c).toMatchObject({ host: 'smtp.gmail.com', port: 465, secure: true, from: 'Haus <me@gmail.com>', ownerName: 'حامد', ownerEmail: 'me@gmail.com' });
    expect(c.auth.pass).toBe('abcdefghijklmnop');
  });
  it('sends notices to Hamed to OWNER_EMAIL when it is set', () => {
    expect(mailConfig({ MAIL_USER: 'me@gmail.com', MAIL_PASSWORD: 'x', OWNER_EMAIL: 'hamed@x.co' }).ownerEmail).toBe('hamed@x.co');
  });
});
