import { useEffect, type RefObject } from 'react';

/**
 * Closes an open popover (a dropdown, the calendar) on a click anywhere outside it, or on Escape. `inside` are the elements
 * that count as "in" it — the field and its floating list, which lives elsewhere in the page. Escape is handled first and
 * stopped, so it closes only the popover and not the modal that holds it.
 */
export function useDismiss(open: boolean, close: () => void, inside: ReadonlyArray<RefObject<Element | null>>): void {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!inside.some((ref) => ref.current?.contains(target))) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey, true);
    };
    // `inside` is a fresh array each render; its refs are stable, so only `open` and `close` decide when to re-listen.
  }, [open]);
}
