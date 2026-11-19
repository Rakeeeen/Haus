import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AppModal } from '@/ui/AppModal';
import type { DaySnapshot } from '@/domain/dailyJournal';
import { MonthFingerprint } from '@/features/home/components/visuals';

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** When the first tile appears, after the dialog itself has come most of the way (it comes out of the name, which is far away). */
const TILES_AFTER = 0.18;

/**
 * One month's fingerprint. Memoised on what it draws, so the clock ticking in Home (which re-renders its parent every minute)
 * doesn't redraw twelve SVGs — least of all while the dialog is still opening, which is when a redraw shows as a stutter.
 */
const MonthTile = React.memo(function MonthTile({ index, year, current, future, days }: {
  index: number;
  year: number;
  current: boolean;
  future: boolean;
  days: Record<string, DaySnapshot>;
}) {
  const still = useReducedMotion();
  const monthKey = `${year}-${String(index + 1).padStart(2, '0')}`;
  const count = Object.keys(days).length;
  const hasData = count > 0;
  return (
    <motion.div
      // Each tile fades up and settles from just under full size, one after another once the dialog is mostly open — nothing
      // travels (the dialog already did), so the two motions don't fight.
      initial={{ opacity: 0, scale: still ? 1 : 0.9 }}
      animate={{ opacity: future ? 0.35 : 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26, delay: still ? 0 : TILES_AFTER + index * 0.03, opacity: { duration: 0.22, delay: still ? 0 : TILES_AFTER + index * 0.03 } }}
      // This month is the one solid tile; months with days in them sit on silver, the rest are just an outline, like the dock's resting cards.
      className={`flex flex-col items-center gap-2 p-3 border rounded-box ${
        current ? 'bg-paper border-ink text-ink'
        : hasData ? 'bg-paper border-transparent text-ink'
        : 'border-dashed border-ink/20 text-ink/40'
      }`}
      data-active={current || undefined}
    >
      {hasData ? (
        <MonthFingerprint monthKey={monthKey} days={days} size={72} />
      ) : (
        <div style={{ width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="w-1 h-1 rounded-full bg-ink/20" />
        </div>
      )}
      <div className={`font-mono-main text-[9px] font-bold tracking-[0.2em] ${current ? 'text-ink' : 'text-ink/50'}`}>{MONTH_NAMES[index]}</div>
      {hasData && <div className="font-mono-main text-[8px] text-ink/40">{count}d</div>}
    </motion.div>
  );
});

/** The year at a glance: a fingerprint for each month, drawn from the days recorded in it. */
export const FingerprintModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  /** The year, and the month (0–11) we are in — passed as numbers, not a `Date`, so a ticking clock doesn't re-render the tiles. */
  year: number;
  currentMonth: number;
  dailyHistory: Record<string, DaySnapshot>;
}> = ({ isOpen, onClose, year, currentMonth, dailyHistory }) => {
  const months = React.useMemo(() => MONTH_NAMES.map((_, i) => {
    const monthKey = `${year}-${String(i + 1).padStart(2, '0')}`;
    return Object.fromEntries(Object.entries(dailyHistory).filter(([k]) => k.startsWith(monthKey)));
  }), [year, dailyHistory]);
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-2xl"
      title={
        <div>
          <div className="font-mono-main text-[10px] font-bold tracking-[0.25em] uppercase mb-2 text-ink/40">Annual fingerprint</div>
          <div className="text-silver font-sans-main text-5xl font-black tracking-tight">{year}</div>
        </div>
      }
    >
      <div className="grid grid-cols-4 gap-3">
        {months.map((days, i) => (
          <MonthTile key={i} index={i} year={year} current={i === currentMonth} future={i > currentMonth} days={days} />
        ))}
      </div>
    </AppModal>
  );
};
