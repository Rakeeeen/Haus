import { describe, expect, it } from 'vitest';
import { FULL_SYNC_EVERY_MS, planSync, SYNC_MARGIN_MS } from '@/domain/sync';

const now = new Date('2026-11-11T10:00:00.000Z');
const record = { fullAt: now.getTime() - 3_600_000, count: 3 };
const held = [{ updatedAt: '2026-11-10T08:00:00.000Z' }, { updatedAt: '2026-11-11T09:30:00.000Z' }, { updatedAt: '2026-11-01T00:00:00.000Z' }];

describe('planSync', () => {
  it('asks only for what changed since the newest change held here, a day earlier for clocks that are off', () => {
    expect(planSync(record, held, now)).toEqual({ mode: 'changes', since: new Date(Date.parse('2026-11-11T09:30:00.000Z') - SYNC_MARGIN_MS).toISOString() });
  });

  it('reads everything the first time, and when nothing is kept here', () => {
    expect(planSync(null, held, now).mode).toBe('full');
    expect(planSync(record, [], now).mode).toBe('full');
  });

  it('reads everything once a week whatever happens', () => {
    expect(planSync({ ...record, fullAt: now.getTime() - FULL_SYNC_EVERY_MS - 1 }, held, now).mode).toBe('full');
  });

  it('reads everything when the copy here has fewer documents than the list had', () => {
    expect(planSync({ ...record, count: 4 }, held, now).mode).toBe('full');
  });

  it('reads everything when no document says when it changed', () => {
    expect(planSync(record, [{}, { updatedAt: 5 }, {}], now).mode).toBe('full');
  });
});
