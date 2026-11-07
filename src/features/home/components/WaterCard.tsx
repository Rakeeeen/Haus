import React from 'react';
import { Button } from '@/ui/Button';
import { IconPlus as Plus } from '@/ui/icons';
import { DotMatrixText } from '@/ui/DotMatrixText';
import { WaterVector } from '@/features/home/components/visuals';

/** The big card's body for Water: today's glass count and the Add Glass action. */
export const WaterCardBody: React.FC<{
  glasses: number;
  fillLevel: number;
  locked: boolean;
  onAddGlass: (e: React.MouseEvent) => void;
}> = ({ glasses, fillLevel, locked, onAddGlass }) => (
  <div className="flex-1 flex flex-col justify-between">
    <div className="flex justify-between items-start">
      <div>
        <h2 className="text-silver text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mt-1">{`WATER`}</h2>
      </div>
      <div className="text-ink opacity-60">
        <WaterVector size={36} fillLevel={fillLevel} />
      </div>
    </div>


    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 mt-6">
      <div className="flex items-end gap-4">
        <DotMatrixText
          text={String(glasses)}
          dotSizeClassName="w-[12px] h-[12px] sm:w-[15px] sm:h-[15px]"
          gapClassName="gap-[4px] sm:gap-[5px]"
        />
        <span className="font-mono-main text-3xl sm:text-4xl font-bold text-ink/40 leading-none">
          / 12
        </span>
        <span className="font-sans-main text-sm font-bold uppercase tracking-wider text-ink/60 ml-2 leading-none">glasses today</span>
      </div>

      <Button onClick={onAddGlass} disabled={locked}>
        <Plus size={18} />
        {locked ? 'Reopens at Fajr' : 'Add Glass'}
      </Button>
    </div>
  </div>
);
