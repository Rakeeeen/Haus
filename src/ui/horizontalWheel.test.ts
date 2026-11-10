import { describe, expect, it } from 'vitest';
import { wheelToScrollLeft } from './horizontalWheel';

const row = { scrollLeft: 100, scrollWidth: 1000, clientWidth: 400 };
const wheel = (deltaY: number, deltaX = 0, shiftKey = false) => ({ deltaX, deltaY, shiftKey });

describe('wheelToScrollLeft', () => {
  it('turns a downward wheel into a scroll to the right, and an upward one to the left', () => {
    expect(wheelToScrollLeft(wheel(60), row)).toBe(160);
    expect(wheelToScrollLeft(wheel(-60), row)).toBe(40);
  });
  it('stops at the ends', () => {
    expect(wheelToScrollLeft(wheel(900), row)).toBe(600);
    expect(wheelToScrollLeft(wheel(-900), row)).toBe(0);
  });
  it('lets the page scroll when the row is already at the end the wheel heads to', () => {
    expect(wheelToScrollLeft(wheel(40), { ...row, scrollLeft: 600 })).toBeNull();
    expect(wheelToScrollLeft(wheel(-40), { ...row, scrollLeft: 0 })).toBeNull();
  });
  it('leaves a row that fits alone', () => {
    expect(wheelToScrollLeft(wheel(60), { scrollLeft: 0, scrollWidth: 400, clientWidth: 400 })).toBeNull();
  });
  it('leaves a wheel that already turns sideways alone (a trackpad, or Shift)', () => {
    expect(wheelToScrollLeft(wheel(10, 80), row)).toBeNull();
    expect(wheelToScrollLeft(wheel(60, 0, true), row)).toBeNull();
  });
});
