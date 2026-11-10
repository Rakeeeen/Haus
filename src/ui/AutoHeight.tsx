import React, { useLayoutEffect, useRef, useState } from 'react';

/**
 * Wraps content whose height changes (a list that filters or grows) so the box eases to its new height on the system's
 * spring, instead of jumping. Nothing here may overflow the box (it clips), so keep popovers outside it.
 */
export const AutoHeight: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    setHeight(el.offsetHeight);
    const watch = new ResizeObserver(() => setHeight(el.offsetHeight));
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  return (
    <div className={className} style={{ height, overflow: 'hidden', transition: 'height var(--spring-duration) var(--spring)' }}>
      <div ref={inner}>{children}</div>
    </div>
  );
};
