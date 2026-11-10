// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLOCK_EMBLEMS } from '@/ui/clockEmblems';
import { PixelClock } from '@/ui/PixelClock';
import { PixelDigits } from '@/ui/PixelDigits';
import { PixelWallClock } from '@/ui/PixelWallClock';
import { CLOCK_FACE, GRID } from '@/ui/pixelClockFace';

describe('the pixel clock face', () => {
  it('is round: the corners of the grid are empty and the middle is full', () => {
    const cells = CLOCK_FACE.cells as Array<{ key: string }>;
    const keys = new Set(cells.map((c) => c.key));
    expect(keys.has('0,0')).toBe(false);
    expect(keys.has(`${GRID - 1},${GRID - 1}`)).toBe(false);
    expect(keys.has('7,7')).toBe(true);
    expect(keys.has('6,6')).toBe(true);
  });
  it('has its hub at the exact middle', () => {
    expect(CLOCK_FACE.center).toBe(CLOCK_FACE.size / 2);
  });
});

describe('PixelDigits', () => {
  it('draws four digits as pixels', () => {
    const { container } = render(<PixelDigits mm="25" ss="07" />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelectorAll('rect').length).toBeGreaterThan(40);
  });
});

describe('PixelClock', () => {
  it('draws the face, one hand and a hub', () => {
    const { container } = render(<PixelClock elapsedSeconds={30} mode="focus" isOvertime={false} running={false} />);
    expect(container.querySelectorAll('line')).toHaveLength(1);
    expect(container.querySelectorAll('circle')).toHaveLength(1);
  });
  it('holds the hand at the second it is paused on', () => {
    const { container } = render(<PixelClock elapsedSeconds={15} mode="focus" isOvertime={false} running={false} />);
    expect((container.querySelector('g[style*="rotate"], g') as SVGGElement).getAttribute('style')).toContain('rotate(90deg)');
  });
});

describe('PixelWallClock', () => {
  it('has hour, minute and second hands, and a hub', () => {
    const { container } = render(<PixelWallClock timeZone="Africa/Cairo" />);
    expect(container.querySelectorAll('line')).toHaveLength(3);
    expect(container.querySelectorAll('circle')).toHaveLength(1);
  });
  it('draws an emblem when given one', () => {
    const plain = render(<PixelWallClock timeZone="UTC" />).container.querySelectorAll('rect').length;
    const withEmblem = render(<PixelWallClock timeZone="UTC" emblem={CLOCK_EMBLEMS.egypt} />).container.querySelectorAll('rect').length;
    expect(withEmblem).toBeGreaterThan(plain);
  });
});
