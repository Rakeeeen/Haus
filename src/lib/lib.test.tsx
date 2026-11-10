// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { niceTicks } from '@/lib/charts';
import { uploadImage } from '@/lib/cloudinary';
import { clearDraft, DRAFT_TTL_MS, loadDraft, saveDraft } from '@/lib/draftMemory';
import { playTaskDone } from '@/lib/sound';
import { applyStoredTheme, isDarkTheme, setTheme } from '@/lib/theme';
import { isDay, manyOf, oneOf, useStoredState } from '@/lib/useStoredState';

beforeEach(() => { localStorage.clear(); document.body.className = ''; });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('useStoredState', () => {
  const valid = oneOf(['a', 'b'] as const);
  it('starts from the default, and remembers a change across a remount', () => {
    const first = renderHook(() => useStoredState('k', 'a' as 'a' | 'b', valid));
    expect(first.result.current[0]).toBe('a');
    act(() => first.result.current[1]('b'));
    expect(first.result.current[0]).toBe('b');
    const second = renderHook(() => useStoredState('k', 'a' as 'a' | 'b', valid));
    expect(second.result.current[0]).toBe('b');
  });
  it('ignores a stored value the screen no longer understands', () => {
    localStorage.setItem('k', JSON.stringify('zzz'));
    expect(renderHook(() => useStoredState('k', 'a' as 'a' | 'b', valid)).result.current[0]).toBe('a');
    localStorage.setItem('k', '{not json');
    expect(renderHook(() => useStoredState('k', 'a' as 'a' | 'b', valid)).result.current[0]).toBe('a');
  });
  it('the validators', () => {
    expect(oneOf(['x'])('x')).toBe(true);
    expect(oneOf(['x'])('y')).toBe(false);
    expect(manyOf(['x', 'y'])(['x', 'y'])).toBe(true);
    expect(manyOf(['x', 'y'])(['x', 'z'])).toBe(false);
    expect(manyOf(['x'])('x')).toBe(false);
    expect(isDay('2026-11-09')).toBe(true);
    expect(isDay('9 Nov')).toBe(false);
    expect(isDay(20261109)).toBe(false);
  });
});

describe('draftMemory', () => {
  it('keeps a draft and gives it back', () => {
    saveDraft('d', { title: 'x' });
    expect(loadDraft('d')).toEqual({ title: 'x' });
  });
  it('lets go of it after ten minutes, and removes it', () => {
    saveDraft('d', { title: 'x' }, 1_000);
    expect(loadDraft('d', 1_000 + DRAFT_TTL_MS)).toEqual({ title: 'x' });
    expect(loadDraft('d', 1_000 + DRAFT_TTL_MS + 1)).toBeNull();
    expect(localStorage.getItem('d')).toBeNull();
  });
  it('clears on request, and survives a broken value', () => {
    saveDraft('d', 1);
    clearDraft('d');
    expect(loadDraft('d')).toBeNull();
    localStorage.setItem('d', '{oops');
    expect(loadDraft('d')).toBeNull();
  });
});

describe('theme', () => {
  it('applies the saved theme, switches, and remembers', () => {
    expect(applyStoredTheme()).toBe(false);
    setTheme(true);
    expect(isDarkTheme()).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
    document.body.className = '';
    expect(applyStoredTheme()).toBe(true);
    expect(isDarkTheme()).toBe(true);
    setTheme(false);
    expect(isDarkTheme()).toBe(false);
  });
});

describe('niceTicks', () => {
  it('lands on whole, even steps', () => {
    expect(niceTicks(10)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(0)).toEqual([0]);
  });
});

describe('uploadImage', () => {
  const file = new File(['x'], 'a.png', { type: 'image/png' });
  it('returns the https address Cloudinary gives', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ secure_url: 'https://img/x.png' }) });
    vi.stubGlobal('fetch', fetchMock);
    expect(await uploadImage(file)).toBe('https://img/x.png');
    expect(fetchMock.mock.calls[0][0]).toContain('/image/upload');
    expect((fetchMock.mock.calls[0][1].body as FormData).get('upload_preset')).toBe('rakeeen_home');
  });
  it('rejects with Cloudinary\'s own reason', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message: 'File too large' } }) }));
    await expect(uploadImage(file)).rejects.toThrow('File too large');
  });
});

describe('the task-done sound', () => {
  function stubAudio() {
    const play = vi.fn().mockResolvedValue(undefined);
    const voices: Array<{ volume: number }> = [];
    class FakeAudio {
      preload = '';
      volume = 1;
      constructor(public src: string) {}
      cloneNode() { const copy = Object.assign(new FakeAudio(this.src), { play }); voices.push(copy); return copy; }
    }
    vi.stubGlobal('Audio', FakeAudio);
    return { play, voices };
  }
  it('plays a modest-volume copy of the chime (so two in a row ring over each other)', () => {
    const { play, voices } = stubAudio();
    playTaskDone();
    playTaskDone();
    expect(play).toHaveBeenCalledTimes(2);
    expect(voices).toHaveLength(2);
    expect(voices[0].volume).toBeGreaterThan(0);
    expect(voices[0].volume).toBeLessThan(0.7);
  });
  it('stays silent when switched off', () => {
    const { play } = stubAudio();
    localStorage.setItem('haus_sound', 'off');
    playTaskDone();
    expect(play).not.toHaveBeenCalled();
  });
  it('never throws when the browser will not play it', () => {
    vi.stubGlobal('Audio', class { constructor() { throw new Error('no audio'); } });
    expect(() => playTaskDone()).not.toThrow();
  });
});
