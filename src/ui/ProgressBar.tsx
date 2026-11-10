import React from 'react';

/** How far along something is, 0–1: a thin track with the done part filled. The bar's length changes on the system's spring. */
export const ProgressBar: React.FC<{ value: number; className?: string; showValue?: boolean }> = ({ value, className = '', showValue = false }) => {
  const share = Math.min(1, Math.max(0, value));
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className="relative h-1.5 flex-1 min-w-[48px] rounded-full bg-ink/10 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(share * 100)}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-sepia"
          style={{ width: `${share * 100}%`, transition: 'width var(--spring-duration) var(--spring)' }}
        />
      </div>
      {showValue && <span className="font-mono-main text-[10px] font-bold text-ink/60 tabular-nums w-9 text-right">{Math.round(share * 100)}%</span>}
    </div>
  );
};
