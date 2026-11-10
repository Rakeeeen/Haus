// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCardSelection } from '@/features/home/useCardSelection';
import { useNow } from '@/features/home/useNow';
import { useZenMode } from '@/features/home/useZenMode';
import { useDockTouch } from '@/features/home/useDockTouch';

const at = (minutes: number) => new Date(new Date('2026-11-09T10:00:00').getTime() + minutes * 60_000);

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(at(0)); });
afterEach(() => vi.useRealTimers());

describe('useCardSelection', () => {
  const flush = () => act(() => { vi.advanceTimersByTime(300); });

  it('starts on Time, the system\'s default', () => {
    const { result } = renderHook(() => useCardSelection({ focusRunning: false, beforeFajr: false, now: at(0) }));
    flush();
    expect(result.current.activeCardId).toBe('time');
    expect(result.current.displayedCardId).toBe('time');
    expect(result.current.systemCardId).toBe('time');
    expect(result.current.bigCardVisible).toBe(true);
  });

  it('a running focus session takes over after Fajr, and gives it back when it ends', () => {
    const { result, rerender } = renderHook((p: { running: boolean }) => useCardSelection({ focusRunning: p.running, beforeFajr: false, now: at(0) }), { initialProps: { running: true } });
    flush();
    expect(result.current.activeCardId).toBe('pomodoro');
    rerender({ running: false });
    flush();
    expect(result.current.activeCardId).toBe('time');
  });

  it('Time always wins before Fajr, even over a running session', () => {
    const { result } = renderHook(() => useCardSelection({ focusRunning: true, beforeFajr: true, now: at(0) }));
    flush();
    expect(result.current.activeCardId).toBe('time');
  });

  it('a card you pick holds for 30 seconds, then the system\'s pick returns', () => {
    const { result, rerender } = renderHook((p: { now: Date }) => useCardSelection({ focusRunning: false, beforeFajr: false, now: p.now }), { initialProps: { now: at(0) } });
    flush();
    act(() => result.current.pickCard('water'));
    flush();
    expect(result.current.displayedCardId).toBe('water');
    rerender({ now: new Date(at(0).getTime() + 20_000) });
    flush();
    expect(result.current.activeCardId).toBe('water');
    rerender({ now: new Date(at(0).getTime() + 40_000) });
    flush();
    expect(result.current.activeCardId).toBe('time');
  });

  it('the big card fades out, swaps, and fades back in', () => {
    const { result } = renderHook(() => useCardSelection({ focusRunning: false, beforeFajr: false, now: at(0) }));
    flush();
    act(() => result.current.pickCard('tasks'));
    expect(result.current.bigCardVisible).toBe(false);
    expect(result.current.displayedCardId).toBe('time');
    flush();
    expect(result.current.displayedCardId).toBe('tasks');
    expect(result.current.bigCardVisible).toBe(true);
  });
});

describe('useZenMode', () => {
  it('takes over after five undisturbed minutes on the Time card', () => {
    const { result, rerender } = renderHook((p: { now: Date }) => useZenMode({ displayedCardId: 'time', focusActive: false, now: p.now }), { initialProps: { now: at(0) } });
    expect(result.current.zenActive).toBe(false);
    rerender({ now: at(4) });
    expect(result.current.zenActive).toBe(false);
    act(() => { vi.setSystemTime(at(5)); });
    rerender({ now: at(5) });
    expect(result.current.zenActive).toBe(true);
  });

  it('is only for Time, or Focus while a session runs — never Water or Finance', () => {
    const { result, rerender } = renderHook((p: { now: Date }) => useZenMode({ displayedCardId: 'water', focusActive: true, now: p.now }), { initialProps: { now: at(0) } });
    act(() => { vi.setSystemTime(at(10)); });
    rerender({ now: at(10) });
    expect(result.current.zenActive).toBe(false);
  });

  it('Focus counts only while a session is running', () => {
    const { result, rerender } = renderHook((p: { now: Date; active: boolean }) => useZenMode({ displayedCardId: 'pomodoro', focusActive: p.active, now: p.now }), { initialProps: { now: at(0), active: false } });
    act(() => { vi.setSystemTime(at(10)); });
    rerender({ now: at(10), active: false });
    expect(result.current.zenActive).toBe(false);
  });

  it('leaving zen resets the wait to three minutes, and the left-edge strip is armed a moment after zen starts', () => {
    const { result, rerender } = renderHook((p: { now: Date }) => useZenMode({ displayedCardId: 'time', focusActive: false, now: p.now }), { initialProps: { now: at(0) } });
    act(() => { vi.setSystemTime(at(5)); });
    rerender({ now: at(5) });
    expect(result.current.zenActive).toBe(true);
    expect(result.current.zenEdgeArmed).toBe(false);
    act(() => { vi.advanceTimersByTime(700); });
    expect(result.current.zenEdgeArmed).toBe(true);
    act(() => result.current.exitZen());
    expect(result.current.zenActive).toBe(false);
    act(() => { vi.setSystemTime(at(7)); });
    rerender({ now: at(7) });
    expect(result.current.zenActive).toBe(false);
    act(() => { vi.setSystemTime(at(9)); }); // three minutes after leaving (a little after the 8-minute mark)
    rerender({ now: at(9) });
    expect(result.current.zenActive).toBe(true);
  });
});

describe('useNow', () => {
  it('changes only when the minute turns or five seconds have passed, not every second', () => {
    const { result } = renderHook(() => useNow());
    const first = result.current;
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current).toBe(first);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current).not.toBe(first);
  });
});

describe('useDockTouch', () => {
  it('holds a quick press for a moment so its push can show', () => {
    const { result } = renderHook(() => useDockTouch());
    act(() => result.current.pressCard('water'));
    expect(result.current.pressedCardId).toBe('water');
    act(() => result.current.releaseCard());
    expect(result.current.pressedCardId).toBe('water');
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.pressedCardId).toBeNull();
  });
});
