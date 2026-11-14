import React from 'react';
import { Button, IconButton } from '@/ui/Button';
import { IconPause as Pause, IconPlay as Play, IconRotateCcw as RotateCcw } from '@/ui/icons';
import { isFocusNightLockedFor } from '@/domain/dayRules';
import { currentDayRole } from '@/data/dataScope';
import { useFridayGate } from '@/data/useFridayGate';
import { usePomodoro } from '@/data/usePomodoro';
import { usePrayer } from '@/data/usePrayer';

/**
 * What can be pressed on the timer, for the state it is in: start/pause/reset while it counts; stop, take a break, restart in
 * overtime; start a new session when a break has run out; skip a break. New sessions can't start between Isha and Fajr, nor on a
 * Friday that hasn't been included from the Water page.
 */
export const FocusControls: React.FC = () => {
  const { timeLeft, isOvertime, running, mode, start, pause, reset, startBreak, startNewSession, skipBreak, saveProgress } = usePomodoro();
  const { friday, includedToday } = useFridayGate();
  const fridayLocked = friday && !includedToday;
  const { times } = usePrayer();
  const nightLocked = isFocusNightLockedFor(currentDayRole(), times);

  const atTheEnd = isOvertime || (mode === 'break' && timeLeft === 0);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="spring-group flex justify-center items-center gap-3">
        {atTheEnd ? (
          <>
            {isOvertime && (
              <IconButton size="lg" onClick={running ? pause : start} data-tip={running ? 'Stop' : 'Resume'} aria-label={running ? 'Stop' : 'Resume'}>
                {running ? <Pause size={18} /> : <Play size={18} />}
              </IconButton>
            )}
            <Button onClick={isOvertime ? startBreak : startNewSession} className="min-w-[180px]">
              <RotateCcw size={14} />
              <span>{isOvertime ? 'Take a break' : 'Start new session'}</span>
            </Button>
            {isOvertime && (
              <IconButton size="lg" onClick={startNewSession} data-tip="Restart from the beginning" aria-label="Restart from the beginning">
                <RotateCcw size={18} />
              </IconButton>
            )}
          </>
        ) : (
          <>
            <IconButton
              tone="ink"
              size="lg"
              onClick={running ? pause : start}
              disabled={!running && (fridayLocked || nightLocked)}
              aria-label={running ? 'Pause' : 'Start'}
              data-tip={
                running ? 'Pause'
                : fridayLocked ? 'Include today from the Water page first'
                : nightLocked ? 'Reopens at Fajr'
                : 'Start'
              }
            >
              {running ? <Pause size={18} /> : <Play size={18} />}
            </IconButton>
            <IconButton size="lg" onClick={reset} data-tip="Reset" aria-label="Reset">
              <RotateCcw size={18} />
            </IconButton>
          </>
        )}

        {mode === 'focus' && running && !isOvertime && (
          <Button tone="outline" size="sm" onClick={saveProgress} className="ml-2">Done</Button>
        )}
      </div>
      {mode === 'break' && <Button tone="ghost" size="sm" onClick={skipBreak}>Skip Break</Button>}
    </div>
  );
};
