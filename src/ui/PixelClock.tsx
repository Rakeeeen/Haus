import React from 'react';
import { ICON_STROKE_LINECAP } from '@/ui/icons';
import { CLOCK_FACE } from '@/ui/pixelClockFace';

/**
 * A pixel-art clock: a square-pixel face in a neutral tone, with one ordinary
 * smooth hand: aluminum for focus, the session's color on a break or in
 * overtime. One turn a minute.
 *
 * The hand is driven by its own animation frame loop at a constant 6°/s, not
 * by the counter's integer-second ticks — those arrive a little early or late,
 * and a hand chasing them stalls and catches up. Instead it free-runs and is
 * only re-anchored to the counter if it ever drifts more than about a second
 * away (a new session, a reset, a tab that was backgrounded). Frozen while
 * paused. The angle is unwrapped so crossing 12 never spins it backwards.
 */
export const PixelClock: React.FC<{
  elapsedSeconds: number;
  mode: 'focus' | 'break';
  isOvertime: boolean;
  running: boolean;
  width?: string;
}> = ({ elapsedSeconds, mode, isOvertime, running, width = '120px' }) => {
  const handColor = isOvertime ? 'var(--pomo-overtime)' : mode === 'break' ? 'var(--pomo-break)' : 'var(--sepia-mark)';
  const counterRef = React.useRef(Math.max(0, Math.floor(elapsedSeconds)));
  counterRef.current = Math.max(0, Math.floor(elapsedSeconds));
  const handRef = React.useRef<SVGGElement>(null);
  // Seconds of elapsed time the hand is currently showing, and when that was set.
  const anchor = React.useRef({ seconds: counterRef.current, at: performance.now() });

  React.useEffect(() => {
    let frame = 0;
    const draw = (seconds: number) => {
      handRef.current?.style.setProperty('transform', `rotate(${seconds * 6}deg)`);
    };
    const tick = () => {
      const counter = counterRef.current;
      let shown = anchor.current.seconds + (performance.now() - anchor.current.at) / 1000;
      // The counter floors and its 200ms interval runs a little late, so a
      // healthy hand sits in [counter, counter + ~1.3). Only a real discontinuity
      // (new session, reset, throttled background tab) is far outside that —
      // a tighter bound mistakes ordinary tick jitter for drift and yanks the
      // hand backwards, which reads as it stalling.
      if (shown < counter - 1.5 || shown > counter + 2.5) {
        shown = counter + 0.5;
        anchor.current = { seconds: shown, at: performance.now() };
      }
      draw(shown);
      frame = requestAnimationFrame(tick);
    };
    if (running) {
      anchor.current = { seconds: Math.max(anchor.current.seconds, counterRef.current), at: performance.now() };
      frame = requestAnimationFrame(tick);
    } else {
      anchor.current = { seconds: counterRef.current, at: performance.now() };
      draw(counterRef.current);
    }
    return () => cancelAnimationFrame(frame);
  }, [running, running ? -1 : Math.floor(elapsedSeconds)]);

  const { size, center, cells } = CLOCK_FACE;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width, height: 'auto' }}>
      {cells}
      <g ref={handRef} style={{ transformOrigin: `${center}px ${center}px` }}>
        <line x1={center} y1={center + 12} x2={center} y2={center - 58} stroke={handColor} strokeWidth={5} strokeLinecap={ICON_STROKE_LINECAP} />
      </g>
      <circle cx={center} cy={center} r={7} fill={handColor} />
    </svg>
  );
};
