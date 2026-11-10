import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buildFocusReports, focusTargetHours, focusTip } from '@/domain/focus/report';
import type { ReportView } from '@/domain/report';
import { usePomodoro } from '@/data/usePomodoro';
import { niceTicks } from '@/lib/charts';
import { ChartTooltip } from '@/ui/ChartTooltip';
import { FilterSelect, PERIOD_OPTIONS } from '@/ui/FilterSelect';

/** The Focus page's second tab: today's totals, and focus hours per day, week or month against the daily target. */
export const FocusAnalysis: React.FC = () => {
  const { sessions, weekStats, history, todayIdx } = usePomodoro();
  const [view, setView] = React.useState<ReportView>('week');
  const focusMinutesToday = Math.round(weekStats?.[todayIdx]?.minutes || 0);
  const reports = buildFocusReports(history, focusMinutesToday, new Date());

  return (
    <div className="card pb-6 p-6 sm:p-8">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
        <div>
          <h2 className="text-silver text-2xl sm:text-3xl font-bold tracking-tight">Performance</h2>
          <div className="flex items-center gap-4 mt-2">
            <span className="font-mono-main text-[10px] font-black text-ink/30 uppercase tracking-widest">
              {sessions} sessions today
            </span>
            <span className="text-ink/15">·</span>
            <span className="font-mono-main text-[10px] font-black text-ink/30 uppercase tracking-widest">
              {Number(((weekStats?.[todayIdx]?.minutes || 0) / 60).toFixed(1))}h focus today
            </span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Period switch */}
          <FilterSelect label="Period" value={view} onChange={setView} options={PERIOD_OPTIONS} />
        </div>
      </div>

      {/* Chart */}
      <div className="h-[240px] w-full">
        <ResponsiveContainer>
          <BarChart
            data={reports[view]}
            margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--ink)" strokeOpacity={0.05} strokeDasharray="0" />
            <XAxis 
              dataKey="name" 
              tick={{ fill: 'var(--ink)', opacity: 0.4, fontSize: 10, fontWeight: 700, fontFamily: 'Geist Mono, monospace' }} 
              axisLine={false} tickLine={false} dy={10} 
            />
            <YAxis 
              tick={{ fill: 'var(--ink)', opacity: 0.4, fontSize: 10, fontWeight: 700, fontFamily: 'Geist Mono, monospace' }} 
              axisLine={false} tickLine={false}
              width={35}
              domain={[0, (dataMax: number) => Math.max(dataMax, focusTargetHours(view))]}
              ticks={niceTicks(focusTargetHours(view))}
            />
            <Tooltip
              cursor={{ fill: 'var(--ink)', fillOpacity: 0.04 }}
              content={<ChartTooltip unit="Hours" getTipMessage={(val) => focusTip(val, view)} />}
            />
          
            <ReferenceLine
              y={focusTargetHours(view)}
              stroke="var(--ink)" 
              strokeDasharray="6 6" 
              strokeOpacity={0.4}
              strokeWidth={1.5}
            />

            <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {reports[view].map((_, i) => (
                <Cell key={i} fill="var(--ink)" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
};
