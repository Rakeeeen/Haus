import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cancelExpire, scheduleExpire } from './expire.js';

const message = (id) => ({ id, delete: vi.fn().mockResolvedValue(undefined) });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('self-deleting cards', () => {
  it('deletes a card a minute after it appeared', () => {
    const m = message('1');
    scheduleExpire(m);
    vi.advanceTimersByTime(59_000);
    expect(m.delete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2_000);
    expect(m.delete).toHaveBeenCalledTimes(1);
  });

  it('a card shown again starts its minute over (timers are replaced, not stacked)', () => {
    const m = message('2');
    scheduleExpire(m);
    vi.advanceTimersByTime(50_000);
    scheduleExpire(m);
    vi.advanceTimersByTime(50_000);
    expect(m.delete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(11_000);
    expect(m.delete).toHaveBeenCalledTimes(1);
  });

  it('a cancelled card stays (the Focus card is meant to be left open)', () => {
    const m = message('3');
    scheduleExpire(m);
    cancelExpire(m);
    vi.advanceTimersByTime(120_000);
    expect(m.delete).not.toHaveBeenCalled();
  });

  it('a failing delete (already gone) is not an error', async () => {
    const m = { id: '4', delete: vi.fn().mockRejectedValue(new Error('Unknown Message')) };
    scheduleExpire(m);
    await vi.advanceTimersByTimeAsync(61_000);
    expect(m.delete).toHaveBeenCalled();
  });

  it('ignores a missing message', () => {
    expect(() => { scheduleExpire(null); cancelExpire(undefined); }).not.toThrow();
  });
});
