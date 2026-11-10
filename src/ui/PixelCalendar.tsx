import React from 'react';
import { DM } from '@/ui/TimerComponents';
import { layoutDayTile } from '@/ui/dayTileLayout';

// Same tones as the pixel clocks' face: a rim ring around an inside, with the 5-row day number in the exact middle.
// The number's columns adapt to it (see layoutDayTile) so the lit digits are always centred.
const FACE = 'color-mix(in srgb, var(--ink) 16%, var(--paper))';
const RIM = 'color-mix(in srgb, var(--ink) 38%, var(--paper))';
const CELL = 10;
const GAP = 1;
const STEP = CELL + GAP;
/** How much smaller than the tile's own cells the day number is drawn, so it sits well inside the circle. */
const DIGIT_SCALE = 0.72;

/**
 * Today's date: a round tile (a true circle in the clocks' tones) with the day number in
 * the middle, in the Focus dot-matrix font. It fills `width` — set it to the diameter you want.
 */
export const PixelDateTile: React.FC<{ date: { day: number }; width?: string }> = ({ date, width = '84px' }) => {
  const digits = [...String(date.day)];
  // Centre what's actually lit, not the 4-column glyph boxes: "1" only lights three columns,
  // so boxes would leave "10" visibly off-centre.
  const glyphs = digits.map((d) => {
    const rows = DM[d] ?? DM['0'];
    const lit = rows.flatMap((row) => row.flatMap((on, c) => (on ? [c] : [])));
    const first = Math.min(...lit);
    return { rows, first, width: Math.max(...lit) - first + 1 };
  });
  const { columns, starts } = layoutDayTile(glyphs.map((g) => g.width));

  // A true circle (not pixels): the rim as a ring in the clocks' rim tone around the face tone. The day number keeps
  // its dot-matrix cells and its centring (layoutDayTile), just scaled down so it sits comfortably inside the ring.
  const side = columns * STEP - GAP;
  const top = side / 2 - (5 * STEP - GAP) / 2;
  const cells: React.ReactNode[] = [];
  glyphs.forEach(({ rows, first }, i) => {
    rows.forEach((row, r) =>
      row.forEach((on, c) => {
        if (!on) return;
        cells.push(
          <rect
            key={`d${i}-${r}-${c}`}
            x={(starts[i] + c - first) * STEP} y={top + r * STEP}
            width={CELL} height={CELL} fill="var(--sepia-mark)"
          />
        );
      })
    );
  });

  // The circle always fills `width`: a day that needs an extra column just gets slightly smaller pixels.
  return (
    <div style={{ width, flexShrink: 0 }} data-tip="Today">
      <svg viewBox={`0 0 ${side} ${side}`} style={{ width: '100%', height: 'auto', display: 'block' }} aria-label={`Day ${date.day}`}>
        <circle cx={side / 2} cy={side / 2} r={side / 2 - CELL / 2} fill={FACE} stroke={RIM} strokeWidth={CELL} />
        <g transform={`translate(${side / 2} ${side / 2}) scale(${DIGIT_SCALE}) translate(${-side / 2} ${-side / 2})`}>{cells}</g>
      </svg>
    </div>
  );
};
