import { describe, it, expect } from 'vitest';
import { currentThndrValue, netFlows, thndrSeries } from '@/domain/finance/thndr';
import type { ThndrEntry, ThndrFlow } from '@/domain/finance/types';

const e = (id: string, value: number, day: number): ThndrEntry => ({ id, value, timestamp: `2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z` });
// Deliberately out of order — stored lists aren't guaranteed to be sorted.
const entries = [e('b', 11000, 10), e('a', 10000, 3), e('c', 9900, 17)];
const flow = (type: ThndrFlow['type'], amount: number, day: number): ThndrFlow => ({
  id: `${type}${day}`, type, amount, part: 'wallet', timestamp: `2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`,
} as ThndrFlow);

describe('thndrSeries', () => {
  it('orders by time, not by position', () => {
    expect(thndrSeries(entries).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('netFlows', () => {
  it('adds deposits, subtracts withdrawals, ignores transfers', () => {
    expect(netFlows([flow('deposit', 500, 5), flow('withdraw', 200, 6), flow('transfer', 900, 7)], null)).toBe(300);
  });
  it('counts only flows after the given time', () => {
    expect(netFlows([flow('deposit', 500, 5), flow('deposit', 100, 20)], '2026-10-17T12:00:00.000Z')).toBe(100);
  });
});

describe('currentThndrValue', () => {
  it('is the latest reading plus what flowed after it', () => {
    expect(currentThndrValue(entries, [flow('deposit', 500, 14), flow('deposit', 700, 20)])).toBe(10600);
  });
  it('is 0 with nothing at all, and never negative from flows alone', () => {
    expect(currentThndrValue([], [])).toBe(0);
    expect(currentThndrValue([], [flow('withdraw', 50, 2)])).toBe(0);
  });
});
