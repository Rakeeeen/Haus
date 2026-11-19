import React, { useLayoutEffect, useRef, useState } from 'react';

/**
 * Wraps content whose height changes (a list that filters or grows, a modal whose tab swaps its fields) so the box eases to
 * its new height on the system's spring, instead of jumping. It clips only while the height is moving: at rest nothing is
 * cut, so a popover (a dropdown, the calendar) opened from inside still shows in full.
 */
export const AutoHeight: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [moving, setMoving] = useState(false);
  const last = useRef<number | null>(null);
  const settle = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => {
      const next = el.offsetHeight;
      if (last.current !== null && next !== last.current) {
        setMoving(true);
        // A transition that never runs (the same height, reduced motion) would never say it ended.
        window.clearTimeout(settle.current);
        settle.current = window.setTimeout(() => setMoving(false), 700);
      }
      last.current = next;
      setHeight(next);
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => { watch.disconnect(); window.clearTimeout(settle.current); };
  }, []);

  return (
    <div
      className={className}
      style={{ height, overflow: moving ? 'hidden' : 'visible', transition: 'height var(--spring-duration) var(--spring)' }}
      onTransitionEnd={(e) => { if (e.target === e.currentTarget && e.propertyName === 'height') { window.clearTimeout(settle.current); setMoving(false); } }}
    >
      <div ref={inner}>{children}</div>
    </div>
  );
};
