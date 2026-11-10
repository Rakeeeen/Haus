import React from 'react';

// 14×14 grid with the clock's center on the corner shared by the middle four
// cells, so the hub sits dead center.
export const GRID = 14;
const C = GRID / 2;
const FACE_RADIUS = 6.95;
const RIM_FROM = 5.9;
const HOUR_MARKS = new Set(['1,6', '1,7', '12,6', '12,7', '6,1', '7,1', '6,12', '7,12']);

const distFromCenter = (r: number, c: number) => Math.hypot(c + 0.5 - C, r + 0.5 - C);

// The pixel face is identical for every clock (Focus and the world clocks), so
// it's built once here rather than on every render of every instance.
export const CLOCK_FACE = (() => {
  const face = 'color-mix(in srgb, var(--ink) 16%, var(--paper))';
  const rim = 'color-mix(in srgb, var(--ink) 38%, var(--paper))';
  const mark = 'color-mix(in srgb, var(--ink) 55%, var(--paper))';
  const cell = 10;
  const gap = 1;
  const step = cell + gap;
  const size = GRID * step - gap;
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const d = distFromCenter(r, c);
      if (d > FACE_RADIUS) continue;
      const key = `${r},${c}`;
      const fill = d > RIM_FROM ? rim : HOUR_MARKS.has(key) ? mark : face;
      cells.push(<rect key={key} x={c * step} y={r * step} width={cell} height={cell} fill={fill} />);
    }
  }
  return { size, center: size / 2, step, cell, cells };
})();
