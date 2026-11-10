import React, { useLayoutEffect, useRef, useState } from 'react';
import { CLOCK_EMBLEMS } from '@/ui/clockEmblems';
import { PixelDigits } from '@/ui/PixelDigits';
import { PixelWallClock } from '@/ui/PixelWallClock';
import { TimeVector } from '@/features/home/components/visuals';
import { clockLayout, clockRowsThatFit, HOME_TIME_ZONE, MAX_CLOCK_ROWS, type ClockParts } from '@/domain/clock';

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

// The clocks' rows are `gap-y-5` apart. A row is only shown if, with it, at least this much room is left between the
// title row (its icon is top right, right above the stack) and the clocks: less than that and they look crowded.
const CLOCK_ROW_GAP_PX = 20;
const CLOCKS_CLEARANCE_PX = 56;

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
 * How many rows the other clocks can stack in right now. At lg the big card has the dock's height, so a shorter dock
 * (a guest's has fewer cards) leaves less room, and the clocks at the top of the stack move down beside the bottom row
 * one at a time (domain/clock.ts) instead of crowding the title row; below lg the card grows with its content.
 */
function useClockRows() {
  const body = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLDivElement>(null); // a clock that is always shown: its height is a row's
  const [rows, setRows] = useState(MAX_CLOCK_ROWS);

  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const measure = () => {
      if (!window.matchMedia('(min-width: 1024px)').matches || !header.current) { setRows(MAX_CLOCK_ROWS); return; }
      const free = el.clientHeight - header.current.offsetHeight - CLOCKS_CLEARANCE_PX;
      setRows(clockRowsThatFit(free, probe.current?.offsetHeight ?? 0, CLOCK_ROW_GAP_PX));
    };
    measure();
    // The card's height changes with the dock; a row's with the screen's width (the clocks scale with it).
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (probe.current) observer.observe(probe.current);
    return () => observer.disconnect();
  }, []);

  return { rows, body, header, probe };
}

/**
 * The big card for the Time dock entry. Same bottom-row layout as Water: the main reading
 * (Egypt's clock and its dotted digits) bottom-left, the rest bottom-right where Add Glass
 * sits. Wraps and right-aligns when the card is too narrow for both.
 */
export const TimeCardBody: React.FC<{ clock: ClockParts }> = ({ clock }) => {
  const { rows, body, header, probe } = useClockRows();
  const layout = clockLayout(rows);
  // min-h-0: the body must be able to be shorter than its content, or it could never tell that it doesn't fit.
  return (
    <div ref={body} className="flex-1 min-h-0 flex flex-col justify-between">
      <div ref={header} className="flex justify-between items-start">
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

        <div className="grid items-start gap-x-6 gap-y-5 ml-auto" style={{ gridTemplateColumns: `repeat(${layout.columns}, auto)` }}>
          {layout.cells.map(({ id, col, row }) => (
            <div key={id} ref={id === 'australia' ? probe : undefined} className="w-[clamp(54px,5.6vw,76px)] opacity-55" style={{ gridColumn: col, gridRow: row }}>
              <LabeledClock id={id} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
