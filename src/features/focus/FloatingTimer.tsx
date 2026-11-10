import React from 'react';
import { useLocation } from 'react-router-dom';
import { usePomodoro } from '@/data/usePomodoro';
import { formatTime } from '@/lib/format';
import { PixelClock } from '@/ui/PixelClock';

interface FloatingTimerProps {
  onNavigate: () => void;
  currentPage: string;
}

export const FloatingTimer: React.FC<FloatingTimerProps> = ({ onNavigate }) => {
  const { running, isOvertime, mode, timeLeft, overtime, focusDuration, breakDuration } = usePomodoro();
  const location = useLocation();

  const total = mode === 'focus' ? focusDuration * 60 : breakDuration * 60;
  const elapsedSeconds = isOvertime ? total + overtime : total - timeLeft;

  const isOnPomodoro = location.pathname.includes('pomodoro');
  const displayTime = isOvertime ? `+${formatTime(overtime)}` : formatTime(timeLeft);

  const isOnHome = location.pathname === '/' || location.pathname === '';

  // Don't render if timer not active or already on pomodoro page
  if ((!running && !isOvertime) || isOnPomodoro) return null;

  // On Home the timer is already shown in the Focus card, so the corner widget is hidden there too.
  if (isOnHome) return null;

  return (
    <button
      onClick={onNavigate}
      className="fixed bottom-8 right-8 z-50 flex items-center justify-center transition-opacity duration-200 hover:opacity-80 outline-none group bg-transparent rounded-full w-[170px] h-[170px] cursor-pointer shadow-none border-none"
      data-tip="Return to Pomodoro"
      aria-label="Return to Pomodoro"
    >
      <div className="relative w-full h-full flex flex-col items-center justify-center gap-3">
        <PixelClock
          elapsedSeconds={elapsedSeconds}
          mode={mode}
          running={running}
          isOvertime={isOvertime}
          width="104px"
        />
        <span className="text-[11px] font-black transition-colors duration-500 tabular-nums leading-none text-ink">
          {displayTime}
        </span>
      </div>
    </button>
  );
};
