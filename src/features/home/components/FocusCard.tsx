import React from 'react';
import { Button, IconButton } from '@/ui/Button';
import { IconPlay as Play } from '@/ui/icons';
import { PixelDigits, PixelClock } from '@/ui/PixelFocusDisplay';
import { HourglassFace } from '@/ui/HourglassFace';
import { hourglassSand } from '@/domain/focus/hourglass';
import { RulerTimer } from '@/ui/RulerTimer';
import { FocusCarousel } from '@/ui/FocusCarousel';
import { FocusVector } from '@/features/home/components/visuals';

/** The big card's body for Focus: live session (ring + digits, swipeable) when one is running or
 *  paused, otherwise today's total and the Start Focus action. */
export const FocusCardBody: React.FC<{
  running: boolean;
  overtime: boolean;
  paused: boolean;
  mode: 'focus' | 'break';
  overtimeSeconds: number;
  timeLeft: number;
  totalSecs: number;
  onResume: (e: React.MouseEvent) => void;
  focusMinutes: number;
  focusHours: string;
  nightLocked: boolean;
  fridayLocked: boolean;
  onStart: (e: React.MouseEvent) => void;
}> = ({
  running, overtime, paused, mode, overtimeSeconds, timeLeft, totalSecs, onResume,
  focusMinutes, focusHours, nightLocked, fridayLocked, onStart,
}) => {
  const accent = overtime ? 'var(--pomo-overtime)' : mode === 'break' ? 'var(--pomo-break)' : 'var(--pomo-focus)';

  if (running || overtime || paused) {
    const secs = overtime ? overtimeSeconds : timeLeft;
    const totalMins = Math.floor(secs / 60);
    const mm = totalMins >= 100 ? String(totalMins) : String(totalMins).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');

    return (
      <div className="flex-1 flex flex-col justify-between">
        {/* Top — status strip, mirrors idle header. Paused gets its own dimmed label —
            the resume control sits below, under the timer. */}
        <div className="flex justify-between items-start">
          <span className="font-mono-main text-[10px] font-bold tracking-[0.25em] uppercase"
            style={{ color: accent, opacity: paused ? 0.4 : 1 }}>
            {overtime ? '● OVERTIME' : paused ? '● PAUSED' : `● ${mode.toUpperCase()}`}
          </span>
        </div>

        {/* Middle — the pixel clock beside the dot-matrix countdown, swipeable with a
            second face */}
        <div className="flex-1 flex items-center justify-center w-full">
          <FocusCarousel
            persistKey="focus_face"
            dotColor={accent}
            pages={[
              <div className="flex items-center justify-center gap-6 w-full">
                <div className="shrink-0">
                  <PixelClock
                    elapsedSeconds={overtime ? totalSecs + overtimeSeconds : totalSecs - timeLeft}
                    mode={mode}
                    running={running}
                    isOvertime={overtime}
                    width="clamp(84px, 14vw, 128px)"
                  />
                </div>
                <div className="min-w-0 flex-1 max-w-[300px]"><PixelDigits mm={mm} ss={ss} color={accent} maxWidth="100%" /></div>
              </div>,
              <div className="flex items-center justify-center w-full px-1">
                <RulerTimer seconds={secs} mm={mm} ss={ss} mode={mode} isOvertime={overtime} running={running} />
              </div>,
              <div className="flex items-center justify-center gap-6 w-full text-ink">
                <div className="shrink-0">
                  <HourglassFace
                    {...hourglassSand(timeLeft, totalSecs, mode, overtime)}
                    mode={mode} running={running} overtime={overtime} size="clamp(84px, 14vw, 128px)"
                  />
                </div>
                <div className="min-w-0 flex-1 max-w-[300px]"><PixelDigits mm={mm} ss={ss} color={accent} maxWidth="100%" /></div>
              </div>,
            ]}
          />
        </div>

        {paused && (
          <div className="flex justify-center">
            <IconButton tone="ink" size="lg" onClick={onResume} data-tip="Resume" aria-label="Resume">
              <Play size={18} />
            </IconButton>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-silver text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mt-1">{`YOUR FOCUS`}</h2>
        </div>
        <div className="text-ink opacity-60">
          <FocusVector size={36} paused={false} />
        </div>
      </div>


      <div className="flex items-end justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <span className="font-mono-main text-5xl sm:text-7xl lg:text-8xl font-black text-ink leading-none">
            {focusMinutes > 0 ? focusHours : '0'}
          </span>
          <span className="font-mono-main text-3xl font-bold text-ink/40">h</span>
          <span className="font-sans-main text-xs font-bold uppercase tracking-wider text-ink/60 ml-1">focused today</span>
        </div>

        <Button
          onClick={onStart}
          disabled={nightLocked || fridayLocked}
          data-tip={nightLocked ? 'Reopens at Fajr' : fridayLocked ? 'Include today from the Water page first' : undefined}
          className="shrink-0"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <polygon points="2,1 9,5 2,9" />
          </svg>
          {nightLocked ? 'REOPENS AT FAJR' : 'START FOCUS'}
        </Button>
      </div>
    </div>
  );
};
