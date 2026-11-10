import { describe, expect, it } from 'vitest';
import { formatDurationText, formatEGP, formatTime } from './format.js';

describe('formatTime', () => {
  it('writes seconds as MM:SS', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(65)).toBe('01:05');
    expect(formatTime(1500)).toBe('25:00');
  });
  it('lets the minutes grow past 99', () => {
    expect(formatTime(100 * 60 + 5)).toBe('100:05');
  });
});

describe('formatDurationText', () => {
  it('minutes under an hour, hours and minutes, whole hours', () => {
    expect(formatDurationText(45)).toBe('45m');
    expect(formatDurationText(90)).toBe('1h 30m');
    expect(formatDurationText(120)).toBe('2h');
  });
  it('rounds, and never goes below zero', () => {
    expect(formatDurationText(59.6)).toBe('1h');
    expect(formatDurationText(-5)).toBe('0m');
  });
});

describe('formatEGP', () => {
  it('rounds and groups the thousands', () => {
    expect(formatEGP(12345.6)).toBe('12,346 EGP');
    expect(formatEGP(0)).toBe('0 EGP');
  });
});
