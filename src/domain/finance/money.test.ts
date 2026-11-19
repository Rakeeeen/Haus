import { describe, it, expect } from 'vitest';
import { evalAmount, formatEGP, normalizeAmountText } from '@/domain/finance/money';

describe('formatEGP', () => {
  it('rounds to whole pounds with thousands separators', () => {
    expect(formatEGP(1234.5)).toBe('1,235 EGP');
    expect(formatEGP(0)).toBe('0 EGP');
  });
});

describe('evalAmount', () => {
  it.each([
    ['1+1', 2], ['250*3-40', 710], ['(100+50)/3', 50], ['1,200', 1200], ['2×5', 10], ['9÷3', 3],
    ['10-2-3', 5], ['-5+10', 5], ['1.5+1.5', 3], ['100', 100], ['2+3*4', 14],
  ])('%s → %s', (text, expected) => expect(evalAmount(text)).toBe(expected));

  it.each(['', '1+', 'abc', '(1+2', '1/0', '1..2', '5)'])('%j is not a number', (text) => expect(evalAmount(text)).toBeNaN());
});

describe('Arabic digits', () => {
  it('are read as English ones', () => {
    expect(normalizeAmountText('١٢٣٫٥')).toBe('123.5');
    expect(normalizeAmountText('۱۰۰')).toBe('100');
    expect(evalAmount('١٥٠٠+٢٥٠')).toBe(1750);
  });
  it('and letters are dropped', () => {
    expect(normalizeAmountText('مية 50 EGP')).toBe(' 50 ');
  });
});
