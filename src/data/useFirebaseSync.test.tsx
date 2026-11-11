// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Firestore, replaced: `scopedDoc` hands back a fake document, `onSnapshot` lets a test play the server's side.
let scope: 'owner' | 'none' = 'owner';
let pushSnapshot: (snap: { exists: () => boolean; data: () => unknown }) => void = () => {};
let listens = 0;
const setDoc = vi.fn(async () => {});
vi.mock('firebase/firestore', () => ({
  onSnapshot: (_doc: unknown, next: (snap: { exists: () => boolean; data: () => unknown }) => void) => { listens += 1; pushSnapshot = next; return () => {}; },
  setDoc: (...args: unknown[]) => setDoc(...(args as [])),
}));
vi.mock('@/data/dataScope', async () => {
  const actual = await vi.importActual<typeof import('@/data/dataScope')>('@/data/dataScope');
  return { ...actual, scopedDoc: () => (scope === 'owner' ? ({ path: 'dashboard/x' } as never) : null) };
});
vi.mock('@/data/firebase', () => ({ db: {} }));

import { useFirebaseSync } from '@/data/useFirebaseSync';
import { stopAllSharedDocs } from '@/data/sharedDoc';

const server = (value: unknown, updatedAt?: string) => ({ exists: () => true, data: () => ({ value, updatedAt }) });

beforeEach(() => {
  stopAllSharedDocs();
  listens = 0;
  localStorage.clear();
  setDoc.mockClear();
  scope = 'owner';
});

describe('useFirebaseSync', () => {
  it('starts from what localStorage holds, else from the initial value', () => {
    localStorage.setItem('glasses', '4');
    expect(renderHook(() => useFirebaseSync('glasses', 0)).result.current[0]).toBe(4);
    expect(renderHook(() => useFirebaseSync('other', 'none')).result.current[0]).toBe('none');
  });

  it('is ready once Firestore has answered, and takes its value', () => {
    const { result } = renderHook(() => useFirebaseSync('glasses', 0));
    expect(result.current[2]).toBe(false);
    act(() => pushSnapshot(server(9, '2026-11-09T10:00:00.000Z')));
    expect(result.current).toMatchObject([9, expect.any(Function), true]);
    expect(localStorage.getItem('glasses')).toBe('9');
  });

  it('is ready with nothing stored in Firestore yet', () => {
    const { result } = renderHook(() => useFirebaseSync('glasses', 0));
    act(() => pushSnapshot({ exists: () => false, data: () => undefined }));
    expect(result.current[2]).toBe(true);
    expect(result.current[0]).toBe(0);
  });

  it('writes a new value to state, localStorage and Firestore at once', async () => {
    const { result } = renderHook(() => useFirebaseSync('glasses', 0));
    await act(async () => { await result.current[1](5); });
    expect(result.current[0]).toBe(5);
    expect(localStorage.getItem('glasses')).toBe('5');
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect((setDoc.mock.calls[0] as unknown[])[1]).toMatchObject({ value: 5, updatedAt: expect.any(String) });
  });

  it('applies a prev => next update to the latest value, even twice in a row', async () => {
    const { result } = renderHook(() => useFirebaseSync('glasses', 0));
    await act(async () => {
      await result.current[1]((v) => v + 1);
      await result.current[1]((v) => v + 1);
    });
    expect(result.current[0]).toBe(2);
  });

  it('ignores a server value older than the last local write', async () => {
    const { result } = renderHook(() => useFirebaseSync('glasses', 0));
    await act(async () => { await result.current[1](5); });
    act(() => pushSnapshot(server(1, '2000-01-01T00:00:00.000Z')));
    expect(result.current[0]).toBe(5);
  });

  it('takes a server value newer than the last local write', async () => {
    const { result } = renderHook(() => useFirebaseSync('glasses', 0));
    await act(async () => { await result.current[1](5); });
    act(() => pushSnapshot(server(8, '2999-01-01T00:00:00.000Z')));
    expect(result.current[0]).toBe(8);
  });

  it('keeps one setValue identity across renders (a changing one made consumers\' effects re-run constantly)', async () => {
    const { result } = renderHook(() => useFirebaseSync('glasses', 0));
    const first = result.current[1];
    await act(async () => { await result.current[1](1); });
    expect(result.current[1]).toBe(first);
  });

  it('signed out: works on the local copy only, and is ready at once', async () => {
    scope = 'none';
    const { result } = renderHook(() => useFirebaseSync('glasses', 0));
    expect(result.current[2]).toBe(true);
    await act(async () => { await result.current[1](3); });
    expect(result.current[0]).toBe(3);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('opens one Firestore listener for a document however many hooks use it, and tells every one of them', () => {
    const a = renderHook(() => useFirebaseSync('glasses', 0));
    const b = renderHook(() => useFirebaseSync('glasses', 0));
    expect(listens).toBe(1);
    act(() => pushSnapshot(server(7, '2026-11-09T10:00:00.000Z')));
    expect(a.result.current[0]).toBe(7);
    expect(b.result.current[0]).toBe(7);
  });

  it('hands a hook that comes later the answer already received, without a new listener', () => {
    renderHook(() => useFirebaseSync('glasses', 0));
    act(() => pushSnapshot(server(7, '2026-11-09T10:00:00.000Z')));
    const late = renderHook(() => useFirebaseSync('glasses', 0));
    expect(listens).toBe(1);
    expect(late.result.current).toMatchObject([7, expect.any(Function), true]);
  });

  it('keeps the listener for a moment after its last user leaves, so coming back does not open it again', () => {
    vi.useFakeTimers();
    try {
      renderHook(() => useFirebaseSync('glasses', 0)).unmount();
      vi.advanceTimersByTime(5_000);
      renderHook(() => useFirebaseSync('glasses', 0));
      expect(listens).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not write what the document already holds, and writes anything different', async () => {
    const { result } = renderHook(() => useFirebaseSync('glasses', 0));
    act(() => pushSnapshot(server(7, '2026-11-09T10:00:00.000Z')));
    await act(async () => { await result.current[1](7); });
    await act(async () => { await result.current[1]((v) => v); });
    expect(setDoc).not.toHaveBeenCalled();
    await act(async () => { await result.current[1](8); });
    expect(setDoc).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current[1](8); });
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  it('always writes before Firestore has shown the document, even if it matches the local copy', async () => {
    localStorage.setItem('glasses', '4');
    const { result } = renderHook(() => useFirebaseSync('glasses', 0));
    await act(async () => { await result.current[1](4); });
    expect(setDoc).toHaveBeenCalledTimes(1);
  });
});
