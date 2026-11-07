import { describe, expect, it } from 'vitest';
import { dockPose, stagePose } from '@/ui/springPose';

describe('dockPose', () => {
  it('leaves everything at rest when nothing is touched', () => {
    expect(dockPose(2, null, 'hover', true)).toEqual({ edges: { top: 0, right: 0, bottom: 0, left: 0 }, shift: 0 });
  });

  it('reaches up, down and right in the desktop column, never left', () => {
    const { edges, shift } = dockPose(1, 1, 'hover', true);
    expect(edges.top).toBeGreaterThan(0);
    expect(edges.bottom).toBeGreaterThan(0);
    expect(edges.right).toBeGreaterThan(0);
    expect(edges.left).toBe(0);
    expect(shift).toBe(0);
  });

  it('reaches left, right and down in the phone row, never up', () => {
    const { edges } = dockPose(1, 1, 'hover', false);
    expect(edges.left).toBeGreaterThan(0);
    expect(edges.right).toBeGreaterThan(0);
    expect(edges.bottom).toBeGreaterThan(0);
    expect(edges.top).toBe(0);
  });

  it('pushes neighbours away, on both sides, exactly as far as the edge reached', () => {
    const { edges } = dockPose(1, 1, 'press', true);
    expect(dockPose(0, 1, 'press', true).shift).toBe(-edges.top);
    expect(dockPose(2, 1, 'press', true).shift).toBe(edges.bottom);
  });

  it('fades the push with distance', () => {
    expect(Math.abs(dockPose(3, 0, 'press', true).shift)).toBeLessThan(Math.abs(dockPose(1, 0, 'press', true).shift));
  });

  it('does not reach past three neighbours', () => {
    expect(dockPose(4, 0, 'press', true).shift).toBe(0);
  });
});

describe('stagePose', () => {
  it('rests when nothing is touched', () => {
    expect(stagePose(null, null, true)).toEqual({
      edges: { top: 0, right: 0, bottom: 0, left: 0 }, dockShift: 0, footerShift: 0,
    });
  });

  it('reaches towards the dock and the date, and leaves the right edge alone', () => {
    const pose = stagePose('hover', null, true);
    expect(pose.edges.left).toBeGreaterThan(0);
    expect(pose.edges.right).toBe(0);
    expect(pose.dockShift).toBe(-pose.edges.left);
    expect(pose.footerShift).toBe(pose.edges.bottom);
  });

  it('pushes harder on a press', () => {
    expect(stagePose('press', null, true).edges.left).toBeGreaterThan(stagePose('hover', null, true).edges.left);
  });

  it('gives way on its near edge by what a dock card reached', () => {
    expect(stagePose(null, 'hover', true).edges.left).toBe(-dockPose(0, 0, 'hover', true).edges.right);
  });

  it('gives way on top when the dock sits above it on a phone', () => {
    const pose = stagePose(null, 'hover', false);
    expect(pose.edges.top).toBeLessThan(0);
    expect(pose.edges.left).toBe(0);
    expect(pose.dockShift).toBe(0);
  });
});
