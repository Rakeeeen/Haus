import React from 'react';
import { zoneOffsetMs } from '@/domain/clock';
import { ICON_STROKE_LINECAP } from '@/ui/icons';
import { CLOCK_FACE, GRID, HAND_FRAME_MS } from '@/ui/pixelClockFace';

/** How far the minute and hour hands move before they are drawn again. */
const HAND_STEP_DEG = 0.25;

// One muted dark tone for every emblem — a step above the face, so the hands stay the focus.
const EMBLEM_COLOR = 'color-mix(in srgb, var(--ink) 30%, var(--paper))';

const ClockEmblem = React.memo<{ rows: readonly string[] }>(({ rows }) => {
  const { size, step, cell } = CLOCK_FACE;
  const emblemStep = step / 2;
  const width = Math.max(...rows.map((r) => r.length));
  const x0 = (size - width * emblemStep) / 2;
  // The bottom row ends a few pixels above the 6 o'clock mark (row N - 2 is the last row inside the rim).
  const y0 = (GRID - 2) * step - 4 - rows.length * emblemStep;
  return (
    <g fill={EMBLEM_COLOR}>
      {rows.flatMap((row, r) =>
        [...row].map((ch, c) => (ch === '#'
          ? <rect key={`${r},${c}`} x={x0 + c * emblemStep} y={y0 + r * emblemStep} width={cell / 2} height={cell / 2} />
          : null)),
      )}
    </g>
  );
});
ClockEmblem.displayName = 'ClockEmblem';

/**
 * The same pixel clock as the Focus face, showing the real time in a time
 * zone, with hour, minute and second hands. All three are drawn every frame
 * from the wall clock, so the second hand sweeps rather than ticks and the
 * minute and hour hands creep the way a real clock's do. The zone's UTC
 * offset is re-read every half minute so a DST change is picked up live.
 */
export const PixelWallClock = React.memo<{
  timeZone: string;
  width?: string;
  /** A pixel emblem (see CLOCK_EMBLEMS) drawn on the face's lower half, under the hands. */
  emblem?: readonly string[];
}>(({ timeZone, width = '110px', emblem }) => {
  const { size, center, cells } = CLOCK_FACE;
  const hourRef = React.useRef<SVGGElement>(null);
  const minuteRef = React.useRef<SVGGElement>(null);
  const secondRef = React.useRef<SVGGElement>(null);

  React.useEffect(() => {
    let frame = 0;
    let offset = zoneOffsetMs(timeZone, Date.now());
    let offsetAt = Date.now();
    let drawnAt = 0;
    let shownMinute = -1;
    let shownHour = -1;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const now = Date.now();
      if (now - drawnAt < HAND_FRAME_MS) return;
      drawnAt = now;
      if (now - offsetAt > 30_000) { offset = zoneOffsetMs(timeZone, now); offsetAt = now; }
      const t = now + offset;
      const rotate = (el: SVGGElement | null, turns: number) =>
        el?.style.setProperty('transform', `rotate(${turns * 360}deg)`);
      rotate(secondRef.current, (t % 60_000) / 60_000);
      // The minute hand turns a tenth of a degree a second and the hour hand far less: each is set again only once it has moved
      // a quarter of a degree, not on every redraw (that was two thirds of everything Home changed each second, for nothing).
      const minute = (t % 3_600_000) / 3_600_000;
      const hour = (t % 43_200_000) / 43_200_000;
      if (Math.abs(minute - shownMinute) * 360 >= HAND_STEP_DEG) { shownMinute = minute; rotate(minuteRef.current, minute); }
      if (Math.abs(hour - shownHour) * 360 >= HAND_STEP_DEG) { shownHour = hour; rotate(hourRef.current, hour); }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [timeZone]);

  const origin = { transformOrigin: `${center}px ${center}px` };
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width, height: 'auto' }}>
      {cells}
      {emblem && <ClockEmblem rows={emblem} />}
      <g ref={hourRef} style={origin}>
        <line x1={center} y1={center + 6} x2={center} y2={center - 34} stroke="var(--ink)" strokeWidth={6} strokeLinecap={ICON_STROKE_LINECAP} />
      </g>
      <g ref={minuteRef} style={origin}>
        <line x1={center} y1={center + 8} x2={center} y2={center - 54} stroke="var(--ink)" strokeWidth={4.5} strokeLinecap={ICON_STROKE_LINECAP} />
      </g>
      <g ref={secondRef} style={origin}>
        <line x1={center} y1={center + 14} x2={center} y2={center - 60} stroke="var(--sepia-mark)" strokeWidth={3.5} strokeLinecap={ICON_STROKE_LINECAP} />
      </g>
      <circle cx={center} cy={center} r={7.5} fill="var(--sepia-mark)" />
    </svg>
  );
});
PixelWallClock.displayName = 'PixelWallClock';
