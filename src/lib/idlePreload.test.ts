import { describe, expect, it, vi } from 'vitest';
import { preloadWhenIdle } from '@/lib/idlePreload';

const now: (run: () => void) => void = (run) => run();

describe('preloadWhenIdle', () => {
  it('loads each page in turn, one after the other', async () => {
    const order: string[] = [];
    const loader = (name: string) => () => { order.push(`start ${name}`); return new Promise<void>((resolve) => setTimeout(() => { order.push(`end ${name}`); resolve(); }, 1)); };
    preloadWhenIdle([loader('a'), loader('b')], now, () => false);
    await new Promise((r) => setTimeout(r, 30));
    expect(order).toEqual(['start a', 'end a', 'start b', 'end b']);
  });

  it('skips a page that fails to load and goes on', async () => {
    const second = vi.fn(() => Promise.resolve());
    preloadWhenIdle([() => Promise.reject(new Error('offline')), second], now, () => false);
    await new Promise((r) => setTimeout(r, 10));
    expect(second).toHaveBeenCalled();
  });

  it('fetches nothing ahead when the connection asks to save data', async () => {
    const load = vi.fn(() => Promise.resolve());
    preloadWhenIdle([load], now, () => true);
    await new Promise((r) => setTimeout(r, 10));
    expect(load).not.toHaveBeenCalled();
  });

  it('waits for the browser to be idle before each one', () => {
    const waiting: Array<() => void> = [];
    const load = vi.fn(() => Promise.resolve());
    preloadWhenIdle([load], (run) => waiting.push(run), () => false);
    expect(load).not.toHaveBeenCalled();
    waiting[0]();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
