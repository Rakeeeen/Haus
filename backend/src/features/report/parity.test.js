// The report ports a few rules by hand from src/domain/ (the two codebases don't share a build).
// This pins them together: the same input must give the same answer in both, so a change made in
// only one place fails here instead of showing up as a wrong number in the daily PDF.
import { describe, it, expect } from 'vitest';
import { nextRenewal, monthlySubscriptionCost } from './data.js';
import { nextRenewal as webNextRenewal, monthlySubscriptionCost as webMonthlyCost } from '../../../../src/domain/finance/subscriptions';

const subs = [
  { id: 'a', name: 'Monthly', cost: 100, renewalDay: 20, intervalMonths: 1, startDate: '2026-01-05' },
  { id: 'b', name: 'Quarterly', cost: 300, renewalDay: 3, intervalMonths: 3, startDate: '2026-02-03', reminderTime: '18:30' },
  { id: 'c', name: 'Yearly', cost: 1200, renewalDay: 31, intervalMonths: 12, startDate: '2025-12-31' },
  { id: 'd', name: 'No start date', cost: 50, renewalDay: 1 },
];
const nows = [
  new Date(2026, 9, 17, 20, 0, 0),
  new Date(2026, 0, 31, 9, 0, 0),
  new Date(2026, 11, 31, 23, 59, 0),
  new Date(2027, 1, 28, 0, 0, 0),
];

describe('report ↔ web parity', () => {
  for (const sub of subs) {
    it(`nextRenewal agrees for "${sub.name}"`, () => {
      for (const now of nows) {
        expect(nextRenewal(sub, now).getTime()).toBe(webNextRenewal(sub, now).getTime());
      }
    });
  }
  it('monthlySubscriptionCost agrees', () => {
    expect(monthlySubscriptionCost(subs)).toBeCloseTo(webMonthlyCost(subs), 6);
  });
});
