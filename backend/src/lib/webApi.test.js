import { describe, expect, it } from 'vitest';
import { isAllowedOrigin, isSubscriptionList, MAX_SUBSCRIPTIONS } from './webApi.js';

describe('isAllowedOrigin', () => {
  it('allows Haus\'s own site and the local dev server', () => {
    expect(isAllowedOrigin('https://rakeeen-uxdesign.github.io')).toBe(true);
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:5174')).toBe(true);
  });
  it('allows a request that has no origin (not a browser page, e.g. curl or the bot itself)', () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
  });
  it('refuses any other site, including look-alikes', () => {
    expect(isAllowedOrigin('https://evil.example')).toBe(false);
    expect(isAllowedOrigin('https://rakeeen-uxdesign.github.io.evil.example')).toBe(false);
    expect(isAllowedOrigin('http://rakeeen-uxdesign.github.io')).toBe(false);
    expect(isAllowedOrigin('http://localhost:5173.evil.example')).toBe(false);
  });
});

const sub = (over = {}) => ({ id: 'a', name: 'Netflix', cost: 200, renewalDay: 5, reminderTime: '09:00', bank: 'cib', intervalMonths: 1, ...over });

describe('isSubscriptionList', () => {
  it('accepts a list of Payit, empty or not, with or without a start date', () => {
    expect(isSubscriptionList([])).toBe(true);
    expect(isSubscriptionList([sub(), sub({ id: 'b', startDate: '2026-01-01' })])).toBe(true);
  });
  it('refuses anything that is not a list', () => {
    expect(isSubscriptionList({})).toBe(false);
    expect(isSubscriptionList(null)).toBe(false);
    expect(isSubscriptionList('x')).toBe(false);
  });
  it('refuses a list with something else in it', () => {
    expect(isSubscriptionList([null])).toBe(false);
    expect(isSubscriptionList([sub({ cost: '200' })])).toBe(false);
    expect(isSubscriptionList([sub({ name: undefined })])).toBe(false);
    expect(isSubscriptionList([sub({ renewalDay: Number.NaN })])).toBe(false);
  });
  it('refuses a list that is too long', () => {
    expect(isSubscriptionList(Array.from({ length: MAX_SUBSCRIPTIONS + 1 }, () => sub()))).toBe(false);
  });
});
