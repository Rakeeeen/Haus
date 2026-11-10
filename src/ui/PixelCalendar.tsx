import React from 'react';
import { DM } from '@/ui/TimerComponents';
import { layoutDayTile } from '@/ui/dayTileLayout';

// Same cells and tones as the pixel clocks' face: a rim ring around an inside, with the
// 5-row day number in the exact middle. The tile is 13 rows tall; its width adapts to the
// number (see layoutDayTile) so the lit digits are always centred on whole columns.
const ROWS = 13;
const FACE = 'color-mix(in srgb, var(--ink) 16%, var(--paper))';
const RIM = 'color-mix(in srgb, var(--ink) 38%, var(--paper))';
const CELL = 10;
const GAP = 1;
const STEP = CELL + GAP;
const DAY_ROW = Math.floor((ROWS - 5) / 2);

/**
 * Today's date: a round pixel tile (the same cells as the clocks' face, kept to a circle) with the day number in
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

  // A cell belongs to the circle when its centre is inside the ellipse that fills the tile (a hair wider than tall
  // when the day needs an extra column); the cells in the outermost ring of it are the rim.
  const inside = (r: number, c: number, shrink: number) => {
    const rx = columns / 2 - shrink;
    const ry = ROWS / 2 - shrink;
    return ((c + 0.5 - columns / 2) / rx) ** 2 + ((r + 0.5 - ROWS / 2) / ry) ** 2 <= 1;
  };
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < columns; c++) {
      if (!inside(r, c, 0)) continue;
      const isRim = !inside(r, c, 1);
      cells.push(<rect key={`${r},${c}`} x={c * STEP} y={r * STEP} width={CELL} height={CELL} fill={isRim ? RIM : FACE} />);
    }
  }
  glyphs.forEach(({ rows, first }, i) => {
    rows.forEach((row, r) =>
      row.forEach((on, c) => {
        if (!on) return;
        cells.push(
          <rect
            key={`d${i}-${r}-${c}`}
            x={(starts[i] + c - first) * STEP} y={(DAY_ROW + r) * STEP}
            width={CELL} height={CELL} fill="var(--sepia-mark)"
          />
        );
      })
    );
  });

  // The circle always fills `width`: a day that needs an extra column just gets slightly smaller pixels.
  return (
    <div style={{ width, flexShrink: 0 }} data-tip="Today">
      <svg viewBox={`0 0 ${columns * STEP - GAP} ${ROWS * STEP - GAP}`} style={{ width: '100%', height: 'auto', display: 'block' }} aria-label={`Day ${date.day}`}>
        {cells}
      </svg>
    </div>
  );
};
