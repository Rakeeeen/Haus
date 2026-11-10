// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetPrayerStoreForTests, usePrayer } from '@/data/usePrayer';

const timings = { Fajr: '04:30', Sunrise: '06:00', Dhuhr: '11:55', Asr: '14:50', Maghrib: '17:20', Isha: '18:45' };
const reply = { code: 200, data: { timings, date: { hijri: { day: '9', year: '1448', month: { ar: 'جمادى الأولى', number: 5 } } } } };

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn().mockResolvedValue({ json: async () => reply });
  vi.stubGlobal('fetch', fetchMock);
  resetPrayerStoreForTests();
});
afterEach(() => vi.unstubAllGlobals());

describe('usePrayer', () => {
  it('fetches once however many components ask, and gives them all the same times', async () => {
    const a = renderHook(() => usePrayer());
    const b = renderHook(() => usePrayer());
    const c = renderHook(() => usePrayer());
    await waitFor(() => expect(a.result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(b.result.current.times).toEqual(timings);
    expect(c.result.current.times).toBe(a.result.current.times);
  });

  it('keeps the hijri date, as text and as numbers', async () => {
    const { result } = renderHook(() => usePrayer());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hijri).toBe('9 جمادى الأولى 1448 هـ');
    expect(result.current.hijriDate).toEqual({ day: 9, month: 5 });
  });

  it('shows what was saved at once, and does not fetch again the same day', async () => {
    localStorage.setItem('prayer_times', JSON.stringify(timings));
    localStorage.setItem('prayer_fetched_on', new Date().toDateString());
    resetPrayerStoreForTests();
    const { result } = renderHook(() => usePrayer());
    expect(result.current.times).toEqual(timings);
    expect(result.current.loading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches again when what was saved is from another day, showing the old times meanwhile', async () => {
    localStorage.setItem('prayer_times', JSON.stringify({ Fajr: '04:00' }));
    localStorage.setItem('prayer_fetched_on', 'Sun Nov 08 2026');
    resetPrayerStoreForTests();
    const { result } = renderHook(() => usePrayer());
    expect(result.current.times).toEqual({ Fajr: '04:00' });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.times).toEqual(timings));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the saved times when the fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    localStorage.setItem('prayer_times', JSON.stringify({ Fajr: '04:00' }));
    resetPrayerStoreForTests();
    const { result } = renderHook(() => usePrayer());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.times).toEqual({ Fajr: '04:00' });
  });
});
