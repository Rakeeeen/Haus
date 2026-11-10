import React from 'react';
import { motion } from 'framer-motion';
import { AppModal } from '@/ui/AppModal';
import { SPRING } from '@/ui/springPose';
import type { DaySnapshot } from '@/domain/dailyJournal';
import { MonthFingerprint } from '@/features/home/components/visuals';

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** The year at a glance: a fingerprint for each month, drawn from the days recorded in it. */
export const FingerprintModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  now: Date;
  dailyHistory: Record<string, DaySnapshot>;
}> = ({ isOpen, onClose, now, dailyHistory }) => {
  const year = now.getFullYear();
  const currentMonth = now.getMonth();
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
        {MONTH_NAMES.map((name, i) => {
          const monthKey = `${year}-${String(i + 1).padStart(2, '0')}`;
          const monthDays = Object.fromEntries(Object.entries(dailyHistory).filter(([k]) => k.startsWith(monthKey)));
          const isFuture = i > currentMonth;
          const hasData = Object.keys(monthDays).length > 0;
          return (
            <motion.div
              key={monthKey}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: isFuture ? 0.35 : 1, y: 0 }}
              transition={{ ...SPRING, delay: i * 0.04, opacity: { delay: i * 0.04, duration: 0.2 } }}
              // This month is the one solid tile; months with days in them sit on silver, the rest are just an outline, like the dock's resting cards.
              className={`flex flex-col items-center gap-2 p-3 border rounded-box ${
                i === currentMonth ? 'bg-paper border-ink text-ink'
                : hasData ? 'bg-paper border-transparent text-ink'
                : 'border-dashed border-ink/20 text-ink/40'
              }`}
              data-active={i === currentMonth || undefined}
            >
              {hasData ? (
                <MonthFingerprint monthKey={monthKey} days={monthDays} size={72} />
              ) : (
                <div style={{ width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="w-1 h-1 rounded-full bg-ink/20" />
                </div>
              )}
              <div className={`font-mono-main text-[9px] font-bold tracking-[0.2em] ${i === currentMonth ? 'text-ink' : 'text-ink/50'}`}>{name}</div>
              {hasData && <div className="font-mono-main text-[8px] text-ink/40">{Object.keys(monthDays).length}d</div>}
            </motion.div>
          );
        })}
      </div>
    </AppModal>
  );
};
