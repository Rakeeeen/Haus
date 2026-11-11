import { describe, expect, it } from 'vitest';
import { advanceTimer, CHECKPOINT_MAX_ADVANCE_S } from './timer.js';

const at = 1_000_000;
const running = { timeLeft: 600, overtime: 0, isOvertime: false, running: true, mode: 'focus' };

describe('advanceTimer', () => {
  it('takes the seconds since the snapshot off a running countdown', () => {
    expect(advanceTimer(running, at, at + 42_900).timeLeft).toBe(558);
  });
  it('adds them to the overtime of a session that ran over', () => {
    expect(advanceTimer({ ...running, timeLeft: 0, isOvertime: true, overtime: 30 }, at, at + 20_000).overtime).toBe(50);
  });
  it('leaves a paused timer and an old snapshot with no time as written', () => {
    const paused = { ...running, running: false };
    expect(advanceTimer(paused, at, at + 30_000)).toBe(paused);
    expect(advanceTimer(running, undefined, at + 30_000)).toBe(running);
  });
  it('stops carrying a snapshot forward once its tab has gone', () => {
    expect(advanceTimer(running, at, at + 3 * 3_600_000).timeLeft).toBe(600 - CHECKPOINT_MAX_ADVANCE_S);
  });
});
