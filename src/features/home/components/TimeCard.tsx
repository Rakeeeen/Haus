import React from 'react';
import { PixelDigits, PixelWallClock, CLOCK_EMBLEMS } from '@/ui/PixelFocusDisplay';
import { TimeVector } from '@/features/home/components/visuals';
import { HOME_TIME_ZONE, type ClockParts } from '@/domain/clock';

// Six zones, all the same size. Every clock keeps the same hands; what sets one apart is
// the pixel landmark on its face plus its name.
const WORLD_CLOCKS = {
  egypt:     { label: 'Egypt',     timeZone: HOME_TIME_ZONE },
  london:    { label: 'London',    timeZone: 'Europe/London' },
  dubai:     { label: 'Dubai',     timeZone: 'Asia/Dubai' },
  saudi:     { label: 'Saudi',     timeZone: 'Asia/Riyadh' },
  oman:      { label: 'Oman',      timeZone: 'Asia/Muscat' },
  australia: { label: 'Australia', timeZone: 'Australia/Sydney' },
} as const;

type ClockId = keyof typeof WORLD_CLOCKS;

// The five other zones as a mirrored "L" (┘): London / Dubai / Australia stacked down the right
// edge, Saudi and Oman running along the bottom row to the left of Australia.
const L_LAYOUT: ReadonlyArray<{ id: ClockId; col: number; row: number }> = [
  { id: 'london',    col: 3, row: 1 },
  { id: 'dubai',     col: 3, row: 2 },
  { id: 'australia', col: 3, row: 3 },
  { id: 'saudi',     col: 2, row: 3 },
  { id: 'oman',      col: 1, row: 3 },
];

// Egypt's clock and its digits share one height, and both scale with the viewport.
const HOME_CLOCK_SIZE = 'clamp(72px, 7vw, 92px)';
const HOME_DIGITS_HEIGHT = 'clamp(56px, 5.4vw, 72px)';

const LabeledClock: React.FC<{ id: ClockId }> = ({ id }) => {
  const { label, timeZone } = WORLD_CLOCKS[id];
  return (
    <div className="w-full flex flex-col items-center gap-1.5">
      <PixelWallClock timeZone={timeZone} emblem={CLOCK_EMBLEMS[id]} width="100%" />
      <span className="font-mono-main text-[8px] sm:text-[9px] font-bold uppercase tracking-wider leading-none">{label}</span>
    </div>
  );
};

/**
 * The big card for the Time dock entry. Same bottom-row layout as Water: the main reading
 * (Egypt's clock and its dotted digits) bottom-left, the rest bottom-right where Add Glass
 * sits. Wraps and right-aligns when the card is too narrow for both.
 */
export const TimeCardBody: React.FC<{ clock: ClockParts }> = ({ clock }) => (
  <div className="flex-1 flex flex-col justify-between">
    <div className="flex justify-between items-start">
      <h2 className="text-silver text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mt-1">TIME</h2>
      <div className="opacity-60">
        <TimeVector size={36} />
      </div>
    </div>

    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-8 mt-6">
      <div className="flex items-center gap-4 sm:gap-5">
        <div className="shrink-0" style={{ width: HOME_CLOCK_SIZE }}>
          <PixelWallClock timeZone={WORLD_CLOCKS.egypt.timeZone} emblem={CLOCK_EMBLEMS.egypt} width="100%" />
        </div>
        <div className="flex items-end gap-2">
          <PixelDigits mm={clock.hour} ss={clock.minute} color="var(--silver-flat)" height={HOME_DIGITS_HEIGHT} flush />
          <span className="font-mono-main text-[10px] font-bold leading-none pb-0.5">{clock.period}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 items-start gap-x-6 gap-y-5 ml-auto">
        {L_LAYOUT.map(({ id, col, row }) => (
          <div key={id} className="w-[clamp(54px,5.6vw,76px)] opacity-55" style={{ gridColumn: col, gridRow: row }}>
            <LabeledClock id={id} />
          </div>
        ))}
      </div>
    </div>
  </div>
);
