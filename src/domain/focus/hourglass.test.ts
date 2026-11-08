import { describe, expect, it } from 'vitest';
import { hourglassSand } from '@/domain/focus/hourglass';

describe('hourglassSand', () => {
  it('starts a focus session with all the sand on top', () => {
    expect(hourglassSand(1500, 1500, 'focus', false)).toEqual({ upper: 1, lower: 0 });
  });

  it('runs into the lower chamber as the session passes', () => {
    expect(hourglassSand(375, 1500, 'focus', false)).toEqual({ upper: 0.25, lower: 0.75 });
  });

  it('runs back the other way on a break, because the glass is flipped', () => {
    expect(hourglassSand(300, 300, 'break', false)).toEqual({ upper: 0, lower: 1 });
    expect(hourglassSand(0, 300, 'break', false)).toEqual({ upper: 1, lower: 0 });
  });

  it('has everything in the lower chamber in overtime', () => {
    expect(hourglassSand(0, 1500, 'focus', true)).toEqual({ upper: 0, lower: 1 });
  });

  it('never goes outside 0–1, even with a bad total', () => {
    expect(hourglassSand(2000, 1500, 'focus', false)).toEqual({ upper: 1, lower: 0 });
    expect(hourglassSand(10, 0, 'focus', false)).toEqual({ upper: 1, lower: 0 });
  });
});
