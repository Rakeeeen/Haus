import React, { useEffect } from 'react';
import { boilSpeed, joinBoil } from '@/ui/boilClock';
import type { Layers } from '@/ui/sketchIcons.data';

/**
 * Renders the hand-drawn icons (scripts/illustrations → sketchIcons.data.ts): a thick ink line over
 * a flat paper shape set a little off it. Paper is --icon-paper and ink follows the text colour,
 * so both follow the theme.
 */
export const Sketch: React.FC<{ layers: Layers }> = ({ layers }) => (
  <>
    {layers.map(([paper, ink], i) => (
      <React.Fragment key={i}>
        <g fill="var(--icon-paper)">{paper.map((d, j) => <path key={j} d={d} />)}</g>
        <g fill="currentColor">{ink.map((d, j) => <path key={j} d={d} />)}</g>
      </React.Fragment>
    ))}
  </>
);

/**
 * The "line boil" of a hand-drawn film: three slightly different redraws, one showing at a time. Which one shows is decided by
 * one clock for the whole page (ui/boilClock.ts) through attributes on <html>, and the CSS (global.css, "Hand-drawn icons")
 * shows it — nothing here animates. `cycle` is how long all three take, in seconds (it picks one of three speeds); `paused`
 * holds the first drawing still.
 */
export const Boil: React.FC<{ frames: readonly Layers[]; cycle?: number; paused?: boolean }> = ({
  frames, cycle = 0.75, paused = false,
}) => {
  useEffect(() => (paused ? undefined : joinBoil()), [paused]);
  const speed = paused ? undefined : boilSpeed(cycle);
  return (
    <g className="sketch-boil-set">
      {frames.map((layers, i) => (
        <g key={i} className="sketch-boil" data-f={i} data-t={speed}>
          <Sketch layers={layers} />
        </g>
      ))}
    </g>
  );
};

/** `viewBox` crops the 1000-unit canvas to what is drawn, for an icon that is tall and thin. */
export const SketchSvg: React.FC<{ size: number | string; viewBox?: string; className?: string; children: React.ReactNode }> = ({ size, viewBox = '0 0 1000 1000', className, children }) => (
  <svg width={viewBox === '0 0 1000 1000' ? size : '100%'} height={size} viewBox={viewBox} className={className} aria-hidden="true" overflow="visible">
    {children}
  </svg>
);
