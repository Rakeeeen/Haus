import React from 'react';
import { MaskedValue, FinanceVector } from '@/features/home/components/visuals';

/** The big card's body for Finance: the physical total, masked like the Finance page itself. */
export const FinanceCardBody: React.FC<{ totalPhysical: number }> = ({ totalPhysical }) => (
  <div className="flex-1 flex flex-col justify-between">
    <div className="flex justify-between items-start">
      <div>
        <h2 className="text-silver text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mt-1">{`FINANCE`}</h2>
      </div>
      <div className="text-ink opacity-60">
        <FinanceVector size={36} />
      </div>
    </div>


    <div className="flex items-end gap-4">
      <div className="flex items-baseline gap-2">
        {totalPhysical > 0 ? (
          <MaskedValue className="text-4xl sm:text-5xl lg:text-6xl leading-none">
            <span className="font-mono-main font-black text-ink">
              {Math.round(totalPhysical).toLocaleString()}
            </span>
            <span className="font-mono-main text-2xl font-bold text-ink/40 ml-2">EGP</span>
          </MaskedValue>
        ) : (
          <span className="font-mono-main text-4xl sm:text-5xl lg:text-6xl font-black text-ink leading-none">—</span>
        )}
      </div>
    </div>
  </div>
);
