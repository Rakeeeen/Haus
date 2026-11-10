import React from 'react';
import { hourglassSand } from '@/domain/focus/hourglass';
import { usePomodoro } from '@/data/usePomodoro';
import { FocusCarousel } from '@/ui/FocusCarousel';
import { HourglassFace } from '@/ui/HourglassFace';
import { PixelClock } from '@/ui/PixelClock';
import { PixelDigits } from '@/ui/PixelDigits';
import { RulerTimer } from '@/ui/RulerTimer';
import { FocusControls } from '@/features/focus/FocusControls';
import { timerColor } from '@/features/focus/timerColor';

/** The Focus page's main card: what the timer is doing, in three faces you swipe between, and the controls under them. */
export const FocusSessionCard: React.FC = () => {
  const { timeLeft, overtime, isOvertime, running, mode, focusDuration, breakDuration } = usePomodoro();
  const color = timerColor(mode, isOvertime);
  const sessionSeconds = focusDuration * 60;
  const breakSeconds = breakDuration * 60;

  const seconds = isOvertime ? overtime : timeLeft;
  const totalMinutes = Math.floor(seconds / 60);
  const mm = totalMinutes >= 100 ? String(totalMinutes) : String(totalMinutes).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <div className="text-center card relative p-6 sm:p-10">
      <div className="text-[10px] uppercase tracking-[0.3em] font-black mb-10">
        <span style={{ color }}>{isOvertime ? 'Over-focusing' : mode === 'focus' ? 'Focus session' : 'Break time'}</span>
      </div>

      {/* Three faces of the same state */}
      <FocusCarousel
        persistKey="focus_face"
        dotColor={color}
        pages={[
          <div key="clock" className="w-full min-h-[220px] flex items-center justify-center gap-5 sm:gap-8">
            <div className="shrink-0">
              <PixelClock
                elapsedSeconds={isOvertime ? sessionSeconds + overtime : (mode === 'focus' ? sessionSeconds : breakSeconds) - timeLeft}
                mode={mode}
                running={running}
                isOvertime={isOvertime}
                width="clamp(84px, 14vw, 128px)"
              />
            </div>
            <div className="min-w-0 flex-1 max-w-[300px]"><PixelDigits mm={mm} ss={ss} color={color} maxWidth="100%" /></div>
          </div>,
          <div key="ruler" className="w-full min-h-[220px] flex items-center justify-center">
            <RulerTimer seconds={seconds} mm={mm} ss={ss} mode={mode} isOvertime={isOvertime} running={running} />
          </div>,
          <div key="hourglass" className="w-full min-h-[220px] flex items-center justify-center gap-4 sm:gap-6 text-ink">
            <div className="shrink-0">
              <HourglassFace
                {...hourglassSand(timeLeft, mode === 'focus' ? sessionSeconds : breakSeconds, mode, isOvertime)}
                mode={mode} running={running} overtime={isOvertime} color={color} size="clamp(112px, 16vw, 160px)"
              />
            </div>
            <div className="min-w-0 flex-1 max-w-[300px]"><PixelDigits mm={mm} ss={ss} color={color} maxWidth="100%" /></div>
          </div>,
        ]}
      />

      <div className="relative flex justify-center mt-6 select-none">
        <span className="text-[10px] uppercase tracking-[0.2em] font-black text-ink/30">
          {mode === 'focus' ? `${focusDuration}m focus session` : `${breakDuration}m health break`}
        </span>
      </div>

      <div className="mt-10"><FocusControls /></div>
    </div>
  );
};
