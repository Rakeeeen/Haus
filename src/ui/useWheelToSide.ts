import { useEffect, useState } from 'react';
import { wheelToScrollLeft } from '@/ui/horizontalWheel';

/**
 * Lets a plain mouse wheel scroll a sideways row that hides its scrollbar (without this a mouse has no way to move it but
 * Shift + wheel; a trackpad scrolls sideways by itself). Put the returned function on the row as its `ref`: it works even if
 * the row appears later (after data loads). The listener is added by hand because React's `onWheel` is passive and so can't
 * stop the page from scrolling too.
 */
export function useWheelToSide(): (el: HTMLElement | null) => void {
  const [row, setRow] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!row) return;
    const onWheel = (e: WheelEvent) => {
      const next = wheelToScrollLeft(e, row);
      if (next === null) return;
      e.preventDefault();
      row.scrollLeft = next;
    };
    row.addEventListener('wheel', onWheel, { passive: false });
    return () => row.removeEventListener('wheel', onWheel);
  }, [row]);
  return setRow;
}
