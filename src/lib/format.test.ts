import { describe, it, expect } from 'vitest';
import { formatTime } from '@/lib/format';

describe('formatTime', () => {
  it('pads under 100 minutes', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(65)).toBe('01:05');
    expect(formatTime(25 * 60)).toBe('25:00');
  });
  it('lets minutes grow past 99', () => {
    expect(formatTime(100 * 60 + 7)).toBe('100:07');
  });
});
