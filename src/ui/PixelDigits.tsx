import React from 'react';
import { DM } from '@/ui/TimerComponents';

/**
 * The second Focus face — a blocky pixel-art style, swipeable alongside the
 * wavy ring (see FocusCarousel). Same DM digit bitmaps (see TimerComponents), just drawn
 * as square pixels instead of dots, to match this style's chunkier look.
 */
export const PixelDigits: React.FC<{ mm: string; ss: string; color?: string; maxWidth?: string; height?: string; flush?: boolean }> = ({
  mm, ss, color = 'var(--ink)', maxWidth = 'min(88vw, 480px)', height, flush = false,
}) => {
  const cell = 15;
  const gap = 3;
  const step = cell + gap;
  const digitW = 4 * step - gap;
  const digitH = 5 * step - gap;
  const colGap = step * 1.1;

  const mmChars = [...(mm || '0')];
  const xPositions: number[] = [];
  let curX = 0;
  mmChars.forEach(() => { xPositions.push(curX); curX += digitW + colGap; });
  const xColon = curX;
  const xSS = xColon + step * 1.6;
  const ssPositions = [xSS, xSS + digitW + colGap];
  const totalW = ssPositions[1] + digitW;
  // The padding is breathing room for the big faces; `flush` drops it so the first
  // pixel column sits exactly on the svg's left edge, for aligning against text.
  const pad = flush ? 0 : cell;

  const renderDigit = (digit: string, tx: number) =>
    (DM[digit] ?? DM['0']).flatMap((row, ri) =>
      row.map((val, ci) => (
        <rect
          key={`${tx}-${ri}-${ci}`}
          x={tx + ci * step} y={ri * step} width={cell} height={cell}
          fill={color} opacity={val ? 1 : 0.08}
        />
      ))
    );

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${totalW + pad * 2} ${digitH + pad * 2}`}
      // `height` pins the digit size regardless of how many digits there are (a 12-hour
      // clock's hour is 1 or 2 digits) — otherwise a fixed width would rescale them.
      style={height ? { height, width: 'auto' } : { width: maxWidth, height: 'auto' }}
      overflow="visible"
    >
      {mmChars.map((ch, i) => renderDigit(ch, xPositions[i]))}
      <rect x={xColon} y={digitH * 0.22} width={cell} height={cell} fill={color} opacity={0.5} />
      <rect x={xColon} y={digitH * 0.62} width={cell} height={cell} fill={color} opacity={0.5} />
      {renderDigit(ss[0] ?? '0', ssPositions[0])}
      {renderDigit(ss[1] ?? '0', ssPositions[1])}
    </svg>
  );
};
