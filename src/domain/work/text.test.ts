import { describe, expect, it } from 'vitest';
import { isRtlText } from './text';

describe('isRtlText', () => {
  it('is true when the first letter is Arabic', () => {
    expect(isRtlText('غزل')).toBe(true);
    expect(isRtlText('  «غزل» Haus')).toBe(true);
  });
  it('is false for Latin text, digits and nothing', () => {
    expect(isRtlText('Haus')).toBe(false);
    expect(isRtlText('12 غزل')).toBe(true);
    expect(isRtlText('12')).toBe(false);
    expect(isRtlText('')).toBe(false);
  });
});
