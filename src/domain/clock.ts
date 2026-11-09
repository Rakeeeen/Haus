/** The zone the Home dock's Time card reads in — home. */
export const HOME_TIME_ZONE = 'Africa/Cairo';

export interface ClockParts {
  /** "5" — no leading zero, 12-hour */
  hour: string;
  /** "07" */
  minute: string;
  /** "AM" | "PM" */
  period: string;
}

/** 12-hour time in `timeZone`, split into parts so the digits can be drawn dotted. */
export function getClockParts(timeZone: string, now: Date = new Date()): ClockParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hour: 'numeric', minute: '2-digit', hour12: true,
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { hour: part('hour'), minute: part('minute'), period: part('dayPeriod') };
}

/** The five other zones, as the Home Time card lays them out. */
export type WorldClockId = 'london' | 'dubai' | 'australia' | 'saudi' | 'oman';

export interface ClockCell { id: WorldClockId; col: number; row: number }

/** The most rows the clocks stack in: London, Dubai and Australia down the right edge. */
export const MAX_CLOCK_ROWS = 3;

/**
 * How many rows of clocks fit in `available` px of height, when a row is `rowHeight` tall with `gap` between
 * rows — never fewer than one (the bottom row always stays) nor more than MAX_CLOCK_ROWS.
 */
export function clockRowsThatFit(available: number, rowHeight: number, gap: number): number {
  if (!(rowHeight > 0)) return MAX_CLOCK_ROWS;
  const rows = Math.floor((available + gap) / (rowHeight + gap));
  return Math.max(1, Math.min(MAX_CLOCK_ROWS, rows));
}

/**
 * The clocks as a mirrored "L" (┘): Australia at the bottom right with Dubai and London stacked above it, and Saudi
 * and Oman running left along the bottom row. A shorter card keeps all five: the top of the stack moves down into the
 * bottom row, London first and then Dubai, so with `rows` rows the stack has `rows - 1` clocks above the bottom row
 * and the bottom row grows to the left. Columns are counted from the left, so the stack stays at the right edge.
 */
export function clockLayout(rows: number): { columns: number; cells: ClockCell[] } {
  const count = Math.max(1, Math.min(MAX_CLOCK_ROWS, Math.round(rows)));
  const stacked: WorldClockId[] = ['london', 'dubai'].slice(MAX_CLOCK_ROWS - count) as WorldClockId[];
  const moved: WorldClockId[] = ['london', 'dubai'].slice(0, MAX_CLOCK_ROWS - count) as WorldClockId[];
  const bottom: WorldClockId[] = [...moved, 'oman', 'saudi', 'australia'];
  const columns = bottom.length;
  return {
    columns,
    cells: [
      ...stacked.map((id, i) => ({ id, col: columns, row: i + 1 })),
      ...bottom.map((id, i) => ({ id, col: i + 1, row: count })),
    ],
  };
}
