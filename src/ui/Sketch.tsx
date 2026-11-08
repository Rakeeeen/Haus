import React from 'react';
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
 * The "line boil" of a hand-drawn film: three slightly different redraws, one showing at a time
 * (global.css, .sketch-boil). `cycle` is how long all three take, in seconds; `paused` holds the
 * one showing.
 */
export const Boil: React.FC<{ frames: readonly Layers[]; cycle?: number; paused?: boolean }> = ({
  frames, cycle = 0.75, paused = false,
}) => (
  <g className="sketch-boil-set">
    {frames.map((layers, i) => (
      <g
        key={i}
        className="sketch-boil"
        style={{
          animationDuration: `${cycle}s`,
          animationDelay: `${(-i * cycle) / frames.length}s`,
          animationPlayState: paused ? 'paused' : 'running',
        }}
      >
        <Sketch layers={layers} />
      </g>
    ))}
  </g>
);

export const SketchSvg: React.FC<{ size: number; className?: string; children: React.ReactNode }> = ({ size, className, children }) => (
  <svg width={size} height={size} viewBox="0 0 1000 1000" className={className} aria-hidden="true" overflow="visible">
    {children}
  </svg>
);
