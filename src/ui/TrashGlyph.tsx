import React from 'react';
import { ICON_STROKE_LINECAP, ICON_STROKE_LINEJOIN, ICON_STROKE_WIDTH } from '@/ui/icons';

/**
 * A bin whose lid lifts as the swipe that deletes pulls further, and tips right open once letting go would delete (the swipe sets
 * `--lift`, 0 to 1, and `data-ready` on an ancestor; the motion is in global.css, under "Trash"). Drawn with the system's icon
 * stroke, so it sits with the other plain icons.
 */
export const TrashGlyph: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={ICON_STROKE_WIDTH}
    strokeLinecap={ICON_STROKE_LINECAP}
    strokeLinejoin={ICON_STROKE_LINEJOIN}
    aria-hidden="true"
    overflow="visible"
  >
    <g className="trash-body">
      <path d="M6 9.5l.9 10a2 2 0 0 0 2 1.8h6.2a2 2 0 0 0 2-1.8l.9-10" />
      <path d="M10 12.5v5M14 12.5v5" />
    </g>
    <g className="trash-lid">
      <path d="M4 7h16" />
      <path d="M9.5 7V5.2a1.2 1.2 0 0 1 1.2-1.2h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
    </g>
  </svg>
);
