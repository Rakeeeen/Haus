import React, { useState } from 'react';
import { FilterSelect } from '@/ui/FilterSelect';
import { IconBanknote as Banknote } from '@/ui/icons';
import { DeleteButton } from '@/features/finance/components/lists';
import { formatEGP } from '@/domain/finance/money';
import { groupLogsByDay, logsInRange, type LogRange } from '@/domain/finance/insights';
import type { FinanceLog } from '@/domain/finance/types';

const RANGES: Array<{ value: LogRange; label: string }> = [
  { value: 'day', label: 'Today' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
];

const dayHeading = (date: Date) => date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });

/** The movements for today / this month / this year, grouped by day with what came in and went out. */
export const LogsTab: React.FC<{ logs: FinanceLog[]; removeLog: (id: string) => Promise<void> }> = ({ logs, removeLog }) => {
  const [range, setRange] = useState<LogRange>('day');
  const days = groupLogsByDay(logsInRange(logs, range));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-sans-main font-black uppercase tracking-wide text-ink text-[13px]">Transaction Logs</h2>
        <FilterSelect label="Showing" value={range} onChange={setRange} options={RANGES} />
      </div>

      {days.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-10 h-10 border border-ink/12 rounded-box flex items-center justify-center text-ink/25"><Banknote size={18} /></div>
          <p className="font-mono-main text-[11px] uppercase tracking-widest text-ink/25">No transactions</p>
        </div>
      ) : (
        <div className="space-y-8">
          {days.map((day) => (
            <section key={day.key}>
              <div className="flex items-baseline justify-between mb-3 border-b border-ink/12 pb-2">
                <h3 className="font-mono-main text-[10px] font-bold uppercase tracking-[0.25em] text-ink/60">{dayHeading(day.date)}</h3>
                <p className="font-mono-main text-[10px] text-ink/40 space-x-4">
                  {day.deposits > 0 && <span>+{formatEGP(day.deposits)}</span>}
                  {day.withdrawals > 0 && <span>−{formatEGP(day.withdrawals)}</span>}
                </p>
              </div>
              <div className="space-y-2">
                {day.logs.map((log) => {
                  const sign = log.type === 'assign' ? (log.amount < 0 ? '−' : '+') : log.type === 'deposit' ? '+' : '−';
                  const name = log.type === 'assign' ? 'Assign' : log.type === 'deposit' ? 'Deposit' : 'Withdraw';
                  return (
                    <div key={log.id} className="card group px-6 py-4 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-sans-main font-black uppercase tracking-widest text-ink text-[13px]">
                          {name}
                          {log.mode && (
                            <span className="font-mono-main font-normal text-ink/25 text-[10px]"> · {log.mode}{log.category ? ` · ${log.category}` : ''}</span>
                          )}
                        </p>
                        <p className="font-mono-main text-ink/40 mt-1 text-[11px]">
                          {[log.bank, log.bucket].filter(Boolean).join(' · ') || 'No bucket'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <p className="font-mono-main font-black text-ink text-xl">{sign}{formatEGP(Math.abs(log.amount))}</p>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <DeleteButton onClick={() => removeLog(log.id)} />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
