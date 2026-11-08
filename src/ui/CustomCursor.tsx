import { useRef } from 'react';
import { useCustomCursor } from '@/ui/useCustomCursor';
import { ICON_STROKE_LINEJOIN } from '@/ui/icons';

const ARROW = 'M5.4 4.4L17.2 11.3L11.5 12.7L9.3 18.2L5.4 4.4Z';

export const CustomCursor = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  useCustomCursor(cursorRef);

  return (
    <div
      ref={cursorRef}
      className="custom-cursor-wrapper hidden md:flex"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 99999,
        width: '28px',
        height: '28px',
        willChange: 'transform',
      }}
    >
      {/* Dynamic vector pointer: fill matches ink (dark in light theme, paper in dark theme), stroke matches background container */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        className="custom-cursor-svg"
      >
        {/* Rounded all round: the paper outline and the ink body both have round joins, so the
            tip and the corners are soft, like the buttons. */}
        <path d={ARROW} fill="var(--paper-dark)" stroke="var(--paper-dark)" strokeWidth={4.2} strokeLinejoin={ICON_STROKE_LINEJOIN} />
        <path d={ARROW} fill="var(--ink)" stroke="var(--ink)" strokeWidth={2.2} strokeLinejoin={ICON_STROKE_LINEJOIN} />
      </svg>
    </div>
  );
};
