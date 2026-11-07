import React from 'react';

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  unit: string;
  getTipMessage: (value: number) => string;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label, unit, getTipMessage }) => {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    return (
      <div 
        className="border border-ink/14 p-6 rounded-box animate-scale-in"
        style={{ backgroundColor: 'var(--paper-dark)', opacity: 1 }}
      >
        <p className="text-ink font-black text-3xl mb-1">{label}</p>
        <p className="text-ink font-black text-xl">{val} {unit}</p>
        <p className="text-[10px] text-ink/40 uppercase tracking-[0.3em] mt-4 font-black">
          {getTipMessage(val)}
        </p>
      </div>
    );
  }
  return null;
};
