import React from 'react';
import { motion } from 'framer-motion';
import { SPRING } from '@/ui/springPose';
import { Boil, SketchSvg } from '@/ui/Sketch';
import { HOURGLASS_ICON } from '@/ui/sketchIcons.data';

/** The chambers' extent on the 1000-unit canvas (scripts/illustrations/shapes.py). */
const UPPER = { top: 130, neck: 470 };
const LOWER = { neck: 530, bottom: 870 };
const SPAN = UPPER.neck - UPPER.top;
/**
 * The sand is set a little off the glass, down and right, like every hand-drawn icon's paper.
 * Flipped for a break, the offset turns over too, so it is reversed to stay down and right.
 */
const OFFSET = { upright: 'translate(18 16)', flipped: 'translate(-18 -16)' };

/**
 * Focus's third face: a hand-drawn hourglass. The sand (paper) runs from the upper chamber to the
 * lower one over the session (domain/focus/hourglass.ts says how much is where); a break flips the
 * glass on the system's spring, and in overtime it trembles. The line boils while time runs.
 */
export const HourglassFace: React.FC<{
  upper: number;
  lower: number;
  mode: 'focus' | 'break';
  running: boolean;
  overtime: boolean;
  /** px, or any CSS length (a clamp() lets it shrink on a phone). */
  size?: number | string;
}> = ({ upper, lower, mode, running, overtime, size = 120 }) => {
  const id = `hg-${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  // Sand rests against whichever end is down. Upright, that's the neck for the upper chamber and
  // the bottom for the lower one; flipped for a break, it's the other way round.
  const flipped = mode === 'break';
  const upperSand = flipped
    ? { y: UPPER.top, h: upper * SPAN }
    : { y: UPPER.neck - upper * SPAN, h: upper * SPAN };
  const lowerSand = flipped
    ? { y: LOWER.neck, h: lower * SPAN }
    : { y: LOWER.bottom - lower * SPAN, h: lower * SPAN };
  const flowing = running && !overtime && (flipped ? lower : upper) > 0.001;
  const ease = { transition: 'y 1s linear, height 1s linear' };

  return (
    <motion.div
      initial={false}
      animate={{ rotate: flipped ? 180 : 0 }}
      transition={SPRING}
      style={{ width: size, height: size }}
    >
      {/* Its own layer: the tremble's CSS transform would otherwise replace the flip's. */}
      <div className={overtime ? 'hourglass-tremble' : undefined}>
      <SketchSvg size="100%">
        <defs>
          <clipPath id={`${id}-u`}><rect x={0} width={1000} y={upperSand.y} height={upperSand.h} style={ease} /></clipPath>
          <clipPath id={`${id}-l`}><rect x={0} width={1000} y={lowerSand.y} height={lowerSand.h} style={ease} /></clipPath>
        </defs>
        <g transform={flipped ? OFFSET.flipped : OFFSET.upright} fill="var(--icon-paper)">
          <path d={HOURGLASS_ICON.inside} clipPath={`url(#${id}-u)`} />
          <path d={HOURGLASS_ICON.lower} clipPath={`url(#${id}-l)`} />
          {flowing && <rect x={494} width={12} y={flipped ? lowerSand.y - 60 : UPPER.neck} height={60} />}
        </g>
        <Boil frames={HOURGLASS_ICON.frames} paused={!running} />
      </SketchSvg>
      </div>
    </motion.div>
  );
};
