import { useRef } from 'react';
import { useCustomCursor } from '@/ui/useCustomCursor';

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
        <path
          d="M4.5 3L18.5 11.2L11.8 12.8L9.2 19.5L4.5 3Z"
          fill="var(--ink)"
          stroke="var(--paper-dark)"
          strokeWidth="1"
          strokeLinejoin="miter"
          strokeMiterlimit="4"
        />
      </svg>
    </div>
  );
};
