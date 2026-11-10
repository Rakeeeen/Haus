import React from 'react';
import { DM } from '@/ui/TimerComponents';
import { BASE_TILE_COLUMNS, layoutDayTile } from '@/ui/dayTileLayout';

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
 * Today's date: a pixel tile with the day number in the middle, in the Focus
 * dot-matrix font and green on the same face as the clocks, and the month's
 * name beneath it, outside the square, in small plain type.
 */
export const PixelDateTile: React.FC<{ date: { day: number; monthName: string }; width?: string }> = ({ date, width = '84px' }) => {
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

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < columns; c++) {
      const isRim = r === 0 || c === 0 || r === ROWS - 1 || c === columns - 1;
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

  // The tile keeps the same pixel size whatever its width: a wider tile just grows past
  // `width` (centred), and the month name stays centred under it.
  return (
    <div className="flex flex-col items-center gap-1.5" style={{ width }}>
      <svg
        viewBox={`0 0 ${columns * STEP - GAP} ${ROWS * STEP - GAP}`}
        style={{ width: `${(columns / BASE_TILE_COLUMNS) * 100}%`, height: 'auto', flexShrink: 0 }}
      >
        {cells}
      </svg>
      <span className="font-mono-main text-[10px] font-normal leading-none">{date.monthName}</span>
    </div>
  );
};
