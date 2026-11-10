import { useEffect, useState, type RefObject } from 'react';

/**
 * The rendered height of an element, kept current as it changes (null until measured). It is read at once and not only from
 * the observer's first callback: under React StrictMode's double-invoked dev effects that first callback has sometimes never
 * come, leaving the height null forever.
 */
export function useElementHeight(ref: RefObject<HTMLElement | null>): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setHeight(el.getBoundingClientRect().height);
    const observer = new ResizeObserver((entries) => setHeight(entries[0].contentRect.height));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}

/** Whether a CSS media query matches, kept current. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
