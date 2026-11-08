import { useRef } from 'react';
import { useCustomCursor } from '@/ui/useCustomCursor';
import { Sketch } from '@/ui/Sketch';
import { CURSOR_ICON } from '@/ui/sketchIcons.data';

/** Pixels per canvas unit at this size, and where the pointer's tip sits on the 1000-unit canvas. */
const SIZE = 26;
const TIP = { x: 110, y: 70 };

/**
 * The pointer, hand-drawn like the icons: an ink outline with its paper behind it. The paper is
 * its own layer and trails the line on the system's spring, settling a few pixels off it like the
 * icons' paper; over something clickable it lifts a little further, and a press pushes it under
 * the line, so it springs back on release (see useCustomCursor).
 */
export const CustomCursor = () => {
  const lineRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  useCustomCursor(lineRef, paperRef);

  const layer = (z: number): React.CSSProperties => ({
    position: 'fixed', top: 0, left: 0, width: SIZE, height: SIZE,
    marginLeft: (-TIP.x / 1000) * SIZE, marginTop: (-TIP.y / 1000) * SIZE,
    pointerEvents: 'none', zIndex: z, willChange: 'transform',
  });

  return (
    <>
      <div ref={paperRef} className="hidden md:block" style={layer(99998)} aria-hidden>
        <svg width={SIZE} height={SIZE} viewBox="0 0 1000 1000">
          <path d={CURSOR_ICON.inside} fill="var(--paper-dark)" />
        </svg>
      </div>
      <div ref={lineRef} className="hidden md:block text-ink" style={layer(99999)} aria-hidden>
        <svg width={SIZE} height={SIZE} viewBox="0 0 1000 1000" overflow="visible">
          <Sketch layers={CURSOR_ICON.frames[0]} />
        </svg>
      </div>
    </>
  );
};
