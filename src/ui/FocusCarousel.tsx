import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { animate, motion, PanInfo, useMotionValue, useMotionValueEvent } from 'framer-motion';

import { SPRING } from '@/ui/springPose';
// Fraction of a page the content has to travel for a release to commit to
// the next page instead of springing back.
const COMMIT_FRACTION = 0.18;
// A trackpad gesture has no "fingers lifted" event — just a stream of wheel
// events that keeps going through the inertia tail. This long a gap means
// the stream (and so the gesture) has ended.
const WHEEL_IDLE_MS = 90;

function readStoredIndex(key: string | undefined, count: number): number {
  if (!key) return 0;
  try {
    const stored = Number(window.localStorage.getItem(key));
    return Number.isInteger(stored) && stored >= 0 && stored < count ? stored : 0;
  } catch {
    return 0;
  }
}

/**
 * A horizontally swipeable set of pages with dot indicators underneath —
 * the Focus ring and the pixel-art face as two faces of the same card, on
 * both Home's mini card and the full /pomodoro page.
 *
 * One motion value drives the track for every input: touch/mouse drag, and
 * a two-finger trackpad swipe (wheel events with horizontal delta). In both
 * the content follows the fingers live, then springs to the nearest page on
 * release — the same feel as a native iOS page control, and never more than
 * one page per gesture no matter how hard the flick.
 */
export const FocusCarousel: React.FC<{
  pages: React.ReactNode[];
  dotColor?: string;
  /** localStorage key to remember the page you were on — pass the same key
   *  everywhere the carousel appears so they all open on your last face. */
  persistKey?: string;
}> = ({ pages, dotColor, persistKey }) => {
  const count = pages.length;
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const [index, setIndex] = useState(() => readStoredIndex(persistKey, count));
  const indexRef = useRef(index);
  const x = useMotionValue(0);

  // The active dot follows wherever the content actually is — the nearest
  // page to its live position — rather than waiting on a gesture-end event.
  // A trackpad swipe has no clean end (just a wheel-event stream that tails
  // off), so keying the dot to the commit made it lag until something else
  // (a mouse move) happened to trigger a repaint.
  useMotionValueEvent(x, 'change', (v) => {
    const w = widthRef.current;
    if (!w) return;
    const nearest = Math.max(0, Math.min(count - 1, Math.round(-v / w)));
    setIndex((prev) => (prev === nearest ? prev : nearest));
  });

  const goTo = useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(count - 1, i));
    indexRef.current = clamped;
    if (persistKey) {
      try { window.localStorage.setItem(persistKey, String(clamped)); } catch { /* storage unavailable — just don't remember */ }
    }
    animate(x, -clamped * widthRef.current, SPRING);
  }, [count, x, persistKey]);

  // Track the container width so page offsets stay in pixels (and snap
  // correctly) across resizes.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      widthRef.current = el.clientWidth;
      setWidth(el.clientWidth);
      x.set(-indexRef.current * el.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [x]);

  // Two-finger trackpad swipe. Has to be a non-passive native listener —
  // React's onWheel is passive, and without preventDefault a horizontal
  // swipe also triggers the browser's own back/forward navigation gesture.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || count < 2) return;
    let gestureBase: number | null = null;
    let idleTimer: number | undefined;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      const w = widthRef.current;
      if (!w) return;
      if (gestureBase === null) gestureBase = -indexRef.current * w;
      const delta = e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX;
      const min = Math.max(gestureBase - w, -(count - 1) * w);
      const max = Math.min(gestureBase + w, 0);
      x.set(Math.min(max, Math.max(min, x.get() - delta)));

      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        const moved = x.get() - (gestureBase ?? 0);
        gestureBase = null;
        if (moved < -w * COMMIT_FRACTION) goTo(indexRef.current + 1);
        else if (moved > w * COMMIT_FRACTION) goTo(indexRef.current - 1);
        else goTo(indexRef.current);
      }, WHEEL_IDLE_MS);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      window.clearTimeout(idleTimer);
    };
  }, [count, goTo, x]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const w = widthRef.current;
    const flicked = Math.abs(info.velocity.x) > 300;
    if (info.offset.x < -w * COMMIT_FRACTION || (flicked && info.velocity.x < 0)) goTo(indexRef.current + 1);
    else if (info.offset.x > w * COMMIT_FRACTION || (flicked && info.velocity.x > 0)) goTo(indexRef.current - 1);
    else goTo(indexRef.current);
  };

  return (
    <div
      className="w-full flex flex-col items-center gap-3 select-none"
      // Hosts like Home's mini card navigate on click of the card itself —
      // without this, swiping (or even just releasing a drag) bubbles up as
      // a click and fires that navigation instead of just switching pages.
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div ref={containerRef} className="w-full overflow-hidden" style={{ overscrollBehaviorX: 'contain', touchAction: 'pan-y' }}>
        <motion.div
          className="flex"
          style={{ x }}
          drag={count > 1 ? 'x' : false}
          dragConstraints={{ left: -(count - 1) * width, right: 0 }}
          dragElastic={0.12}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
        >
          {pages.map((page, i) => (
            <div key={i} className="w-full shrink-0 flex items-center justify-center">
              {page}
            </div>
          ))}
        </motion.div>
      </div>

      {count > 1 && (
        <div className="flex items-center gap-1.5">
          {pages.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`View ${i + 1}`}
              className="cursor-pointer p-1 -m-1"
            >
              <span
                className="block rounded-full transition-all duration-300 ease-out"
                style={{
                  width: i === index ? 14 : 5,
                  height: 5,
                  backgroundColor: dotColor ?? 'var(--ink)',
                  opacity: i === index ? 0.9 : 0.25,
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
