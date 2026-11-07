import React from 'react';
import grainOnLight from '@/styles/textures/grain-title-on-light.png';
import grainOnDark from '@/styles/textures/grain-title-on-dark.png';

/**
 * The titles' aluminum as an SVG paint, for things that aren't text, like a clock's hands.
 * Put it inside an <svg> and use `url(#id)` as a fill or stroke. The grain belongs to the metal,
 * so it turns with the hand. Both tiles are always in the DOM and global.css shows the one for
 * the current theme, because a CSS variable can't reach an <image> href.
 */
export const SilverPaint: React.FC<{ id: string; size: number }> = ({ id, size }) => {
  // Twice the face: at the clocks' usual sizes that keeps a grain close to one screen pixel.
  const tile = size * 2;
  return (
    <defs>
      <linearGradient id={`${id}-light`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={size}>
        <stop offset="0" style={{ stopColor: 'var(--silver-high)' }} />
        <stop offset="1" style={{ stopColor: 'var(--silver-low)' }} />
      </linearGradient>
      <pattern id={id} patternUnits="userSpaceOnUse" width={tile} height={tile}>
        <rect width={tile} height={tile} fill={`url(#${id}-light)`} />
        <image className="silver-grain-on-light" href={grainOnLight} width={tile} height={tile} />
        <image className="silver-grain-on-dark" href={grainOnDark} width={tile} height={tile} />
      </pattern>
    </defs>
  );
};

/** A document-unique id that is safe inside `url(#…)`. */
export const useSilverId = () => `silver-${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`;
