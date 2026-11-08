import React, { useState, useEffect, useRef } from 'react';
import type { FinanceBanks, FinanceBuckets } from '@/domain/finance/types';
import { formatEGP } from '@/domain/finance/money';
import { ICON_STROKE_LINECAP, ICON_STROKE_WIDTH } from '@/ui/icons';
import { Boil, SketchSvg } from '@/ui/Sketch';
import {
  AHLY_MAIN_ICON, AHLY_MEEZA_ICON, BANQUE_MISR_ICON, BASMALA_ICON, CIB_ICON, MUSTAQBAL_ICON,
  SADAQA_ICON, TAWARR2_ICON, type Layers,
} from '@/ui/sketchIcons.data';

/**
 * Purely presentational pieces for the Finance screen: the hand-drawn bank/bucket
 * icons, the privacy-blur value mask, and the flash-on-change animated
 * number. No app state — just props in, SVG/markup out.
 */

// Balance → animation duration: slow at 0 EGP (12s), fast at 100k+ EGP (2s)
function balanceToDuration(balance: number): number {
  const norm = Math.min(1, (balance || 0) / 100_000);
  return Math.max(2, 12 - norm * 10);
}

// Banks: hand-drawn marks (scripts/illustrations). Their line boils faster the more money the
// account holds, the way the old dots ran faster.
const sketchVector = (frames: readonly Layers[]): React.FC<{ balance: number }> => {
  const Vector: React.FC<{ balance: number }> = ({ balance }) => (
    <SketchSvg size={32} className="text-ink">
      <Boil frames={frames} cycle={balanceToDuration(balance) / 4} />
    </SketchSvg>
  );
  return Vector;
};
const CIBVector = sketchVector(CIB_ICON.frames);                 // diamond, like CIB's mark
const AhlyMainVector = sketchVector(AHLY_MAIN_ICON.frames);      // ankh
const AhlyMeezaVector = sketchVector(AHLY_MEEZA_ICON.frames);    // the card
const BanqueMisrVector = sketchVector(BANQUE_MISR_ICON.frames);  // pyramid

// Animated price number — flashes green/red on change
// Spinning vector that hides the value until hover
/** `align="end"` draws the mask against the right edge, for amounts that sit flush right. */
export const MaskedValue: React.FC<{ children: React.ReactNode; className?: string; disabled?: boolean; align?: 'start' | 'end' }> = ({ children, className = '', disabled = false, align = 'start' }) => {
  const [revealed, setRevealed] = useState(false);
  if (disabled) return <span className={className}>{children}</span>;
  return (
    <span
      className={`relative inline-block cursor-pointer select-none ${className}`}
      onMouseEnter={() => setRevealed(true)}
      onMouseLeave={() => setRevealed(false)}
    >
      {/* Spinning asterisk mask — positioned absolute so container = value width */}
      <span
        className={`absolute inset-0 flex items-center transition-opacity duration-200 ${align === 'end' ? 'justify-end' : 'justify-start'}`}
        style={{ opacity: revealed ? 0 : 1, pointerEvents: 'none' }}
        aria-hidden
      >
        <svg width="2.2em" height="0.8em" viewBox="0 0 44 14" fill="none">
          <style>{`@keyframes mvr{to{transform:rotate(360deg)}}@keyframes mvrr{to{transform:rotate(-360deg)}}`}</style>
          {[0,1,2].map(i => {
            const cx = 7 + i * 15;
            const cy = 7;
            const r = 4;
            const anim = i === 1 ? 'mvrr' : 'mvr';
            const dur = 2 + i * 0.5;
            return (
              <g key={i} style={{ animation: `${anim} ${dur}s linear infinite`, transformOrigin: `${cx}px ${cy}px`, opacity: 0.25 + i * 0.2 }}>
                <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} strokeLinecap={ICON_STROKE_LINECAP} />
                <line x1={cx - r * 0.5} y1={cy - r * 0.866} x2={cx + r * 0.5} y2={cy + r * 0.866} stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} strokeLinecap={ICON_STROKE_LINECAP} />
                <line x1={cx + r * 0.5} y1={cy - r * 0.866} x2={cx - r * 0.5} y2={cy + r * 0.866} stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} strokeLinecap={ICON_STROKE_LINECAP} />
              </g>
            );
          })}
        </svg>
      </span>
      {/* Value — invisible but holds layout width */}
      <span className="transition-opacity duration-200" style={{ opacity: revealed ? 1 : 0 }}>
        {children}
      </span>
    </span>
  );
};

export const AnimatedValue: React.FC<{ value: number; className?: string }> = ({ value, className = '' }) => {
  const prevRef = useRef(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (value !== prevRef.current) {
      setFlash(value > prevRef.current ? 'up' : 'down');
      prevRef.current = value;
      const t = setTimeout(() => setFlash(null), 900);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <span
      className={`transition-colors duration-500 ${className}`}
      style={{
        color: flash === 'up' ? 'var(--forest)' : flash === 'down' ? 'var(--rust)' : 'var(--ink)',
      }}
    >
      {formatEGP(value)}
    </span>
  );
};

export const BANK_LABELS: Record<keyof FinanceBanks, string> = {
  cib: 'CIB',
  ahly_main: 'Ahly Main',
  ahly_meeza: 'Ahly Meeza',
  bm: 'Banque Misr',
};

export const BANK_KEYS = Object.keys(BANK_LABELS) as Array<keyof FinanceBanks>;

export const BANK_VECTORS: Record<keyof FinanceBanks, React.ComponentType<{ balance: number }>> = {
  cib: CIBVector,
  ahly_main: AhlyMainVector,
  ahly_meeza: AhlyMeezaVector,
  bm: BanqueMisrVector,
};

// Buckets, the same way.
const MustaqbalVector = sketchVector(MUSTAQBAL_ICON.frames);  // shield: kept safe
const Tawarr2Vector = sketchVector(TAWARR2_ICON.frames);      // lightning: urgent
const BasmalaVector = sketchVector(BASMALA_ICON.frames);      // crescent
const SadaqaVector = sketchVector(SADAQA_ICON.frames);        // sprout: giving grows

export const BUCKET_VECTORS: Record<keyof FinanceBuckets, React.ComponentType<{ balance: number }>> = {
  mustaqbal: MustaqbalVector,
  tawarr2:   Tawarr2Vector,
  basmala:   BasmalaVector,
  sadaqa:    SadaqaVector,
};

export const BUCKET_META: Record<keyof FinanceBuckets, { en: string }> = {
  tawarr2:  { en: "Tawarru'" },
  mustaqbal:{ en: 'Future' },
  basmala:  { en: 'Basmala' },
  sadaqa:   { en: 'Sadaqa' },
};
