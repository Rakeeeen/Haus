import { describe, it, expect } from 'vitest';
import { buildFocusReports, focusTargetHours, focusTip } from '@/domain/focus/report';

describe('focusTargetHours', () => {
  it('is ten hours a day, scaled up for a week-long and a month-long bar', () => {
    expect(focusTargetHours('week')).toBe(10);
    expect(focusTargetHours('month')).toBe(70);
    expect(focusTargetHours('year')).toBe(300);
  });
});

describe('buildFocusReports', () => {
  const saturday = new Date('2026-10-10T15:00:00');

  it('turns minutes into hours, to two decimals', () => {
    const history = { [new Date('2026-10-05T12:00:00').toDateString()]: { minutes: 100 } };
    const { week, month } = buildFocusReports(history, 150, saturday);
    expect(week[0].hours).toBe(2.5);          // today
    expect(month[0].hours).toBe(1.67);        // the 5th
  });

  it('days with no minutes count as zero', () => {
    const history = { [new Date('2026-10-05T12:00:00').toDateString()]: {} };
    expect(buildFocusReports(history, 0, saturday).month[0].hours).toBe(0);
  });
});

describe('focusTip', () => {
  it('compares the hours with the target for the view', () => {
    expect(focusTip(10, 'week')).toBe('Elite Focus!');
    expect(focusTip(7, 'week')).toBe('Almost there!');
    expect(focusTip(2, 'week')).toBe('Keep pushing');
    expect(focusTip(50, 'month')).toBe('Almost there!'); // the month's target is 70
  });
});
