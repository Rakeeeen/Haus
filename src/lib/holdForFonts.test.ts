// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { holdForFonts } from '@/lib/holdForFonts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('holdForFonts', () => {
  it('holds the page until the fonts have loaded, then lets go', async () => {
    const root = document.createElement('html');
    const finishers: Array<() => void> = [];
    const fonts = { load: vi.fn(() => new Promise<FontFace[]>((resolve) => { finishers.push(() => resolve([])); })) } as unknown as FontFaceSet;
    holdForFonts(1200, root, fonts);
    expect(root.classList.contains('fonts-pending')).toBe(true);
    finishers.forEach((finish) => finish());
    await vi.advanceTimersByTimeAsync(0);
    expect(root.classList.contains('fonts-pending')).toBe(false);
  });

  it('never waits longer than the limit', async () => {
    const root = document.createElement('html');
    const fonts = { load: vi.fn(() => new Promise<FontFace[]>(() => {})) } as unknown as FontFaceSet;
    holdForFonts(1200, root, fonts);
    await vi.advanceTimersByTimeAsync(1199);
    expect(root.classList.contains('fonts-pending')).toBe(true);
    await vi.advanceTimersByTimeAsync(2);
    expect(root.classList.contains('fonts-pending')).toBe(false);
  });

  it('does nothing where the browser has no font API', () => {
    const root = document.createElement('html');
    holdForFonts(1200, root, undefined);
    expect(root.classList.contains('fonts-pending')).toBe(false);
  });
});
