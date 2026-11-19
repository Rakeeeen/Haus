import { describe, it, expect } from 'vitest';
import { decideSwipe, velocityOf } from '@/ui/swipeDecision';

describe('decideSwipe', () => {
  const t = 200;
  it('a slow pull must reach the line', () => {
    expect(decideSwipe({ pull: 190, threshold: t, velocity: 0.05 })).toBe('back');
    expect(decideSwipe({ pull: 210, threshold: t, velocity: 0.05 })).toBe('delete');
  });
  it('a quick flick deletes from a short way', () => {
    expect(decideSwipe({ pull: 80, threshold: t, velocity: 1.2 })).toBe('delete');
    expect(decideSwipe({ pull: 30, threshold: t, velocity: 1.2 })).toBe('back');
  });
  it('a hand already coming back is a change of mind, even past the line', () => {
    expect(decideSwipe({ pull: 260, threshold: t, velocity: -0.6 })).toBe('back');
  });
  it('a pause past the line, with the hand still, deletes', () => {
    expect(decideSwipe({ pull: 230, threshold: t, velocity: 0 })).toBe('delete');
  });
});

describe('velocityOf', () => {
  it('is distance over time for the last moments, leftward positive', () => {
    expect(velocityOf([[0, 10], [50, 10], [100, 10]], 100)).toBeCloseTo(0.4, 1);
  });
  it('ignores older steps and is negative when the hand comes back', () => {
    expect(velocityOf([[0, 50], [190, -10], [200, -10]], 200)).toBeLessThan(0);
  });
  it('is 0 with nothing recent', () => {
    expect(velocityOf([[0, 10]], 500)).toBe(0);
    expect(velocityOf([], 0)).toBe(0);
  });
});
