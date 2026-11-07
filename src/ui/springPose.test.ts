import { describe, expect, it } from 'vitest';
import { springPose, stagePose } from '@/ui/springPose';

describe('springPose', () => {
  it('leaves everything at rest when nothing is touched', () => {
    expect(springPose(2, null, 'hover')).toEqual({ scale: 1, shift: 0 });
  });

  it('grows the touched item without moving it', () => {
    const pose = springPose(1, 1, 'press');
    expect(pose.scale).toBeGreaterThan(1);
    expect(pose.shift).toBe(0);
  });

  it('pushes neighbours away from the touched item, on both sides', () => {
    expect(springPose(0, 1, 'press').shift).toBeLessThan(0);
    expect(springPose(2, 1, 'press').shift).toBeGreaterThan(0);
  });

  it('fades the push with distance', () => {
    const near = Math.abs(springPose(1, 0, 'press').shift);
    const far = Math.abs(springPose(3, 0, 'press').shift);
    expect(far).toBeLessThan(near);
  });

  it('pushes harder on a press than on a hover', () => {
    expect(springPose(1, 0, 'press').shift).toBeGreaterThan(springPose(1, 0, 'hover').shift);
  });

  it('does not reach past three neighbours', () => {
    expect(springPose(4, 0, 'press').shift).toBe(0);
  });
});

describe('stagePose', () => {
  it('rests when nothing is touched', () => {
    expect(stagePose(null, null)).toEqual({ scale: 1, stageShift: 0, dockShift: 0, footerShift: 0 });
  });

  it('grows the big card and pushes the dock left and the date down', () => {
    const pose = stagePose('hover', null);
    expect(pose.scale).toBeGreaterThan(1);
    expect(pose.dockShift).toBeLessThan(0);
    expect(pose.footerShift).toBeGreaterThan(0);
  });

  it('pushes harder on a press', () => {
    expect(stagePose('press', null).dockShift).toBeLessThan(stagePose('hover', null).dockShift);
  });

  it('nudges the big card right when a dock card is touched', () => {
    expect(stagePose(null, 'hover').stageShift).toBeGreaterThan(0);
  });
});
