import { useEffect, useRef, useState } from 'react';
import { CHEERS, drawCheer, validBag, type CheerBag } from '@/domain/work/cheers';

const KEY = 'haus.cheerBag';

const read = (): CheerBag | null => {
  try { return validBag(JSON.parse(localStorage.getItem(KEY) ?? 'null')); } catch { return null; }
};
const write = (bag: CheerBag) => {
  try { localStorage.setItem(KEY, JSON.stringify(bag)); } catch { /* storage can be off; the sentence then simply isn't remembered */ }
};

/**
 * The sentence the Tasks card shows when everything is done. A new one is drawn each time the list *becomes* clear (the last
 * tick), not on every visit: opening Home while it is already clear shows the same one. `clear` is null until the tasks have
 * loaded (an empty list then isn't "done" yet). The pile is kept on this device, so no sentence repeats until all fifty
 * have been shown.
 */
export function useCheer(clear: boolean | null): string {
  const [bag, setBag] = useState<CheerBag>(() => {
    const first = read() ?? drawCheer(null);
    write(first);
    return first;
  });
  const latest = useRef(bag);
  latest.current = bag;
  const was = useRef<boolean | null>(null);

  useEffect(() => {
    if (clear === null) return;
    if (clear && was.current === false) {
      const next = drawCheer(latest.current);
      write(next);
      setBag(next);
    }
    was.current = clear;
  }, [clear]);

  return CHEERS[bag.current];
}
