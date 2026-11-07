import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { SPRING } from '@/ui/springPose';
import { FINANCE_ICON, FOCUS_ICON, TIME_ICON, WATER_ICON, type Layers } from '@/ui/sketchIcons.data';
import { ICON_STROKE_WIDTH } from '@/ui/icons';

/**
 * Purely presentational pieces for the Home screen: the privacy-blur value
 * mask, the dot-matrix section icons, and the monthly "fingerprint" chart.
 * No app state — just props in, SVG out.
 */

export const MaskedValue: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  const [revealed, setRevealed] = useState(false);
  return (
    <span className={`relative inline-block cursor-pointer select-none ${className}`}
      onMouseEnter={() => setRevealed(true)}
      onMouseLeave={() => setRevealed(false)}
    >
      <span className="absolute inset-0 flex items-center justify-start transition-opacity duration-200"
        style={{ opacity: revealed ? 0 : 1, pointerEvents: 'none' }}
        aria-hidden>
        <svg width="2.2em" height="0.8em" viewBox="0 0 44 14" fill="none">
          <style>{`@keyframes mvr{to{transform:rotate(360deg)}}@keyframes mvrr{to{transform:rotate(-360deg)}}`}</style>
          {[0,1,2].map(i => {
            const cx = 7 + i * 15, cy = 7, r = 4;
            const anim = i === 1 ? 'mvrr' : 'mvr';
            return (
              <g key={i} style={{ animation: `${anim} ${2 + i * 0.5}s linear infinite`, transformOrigin: `${cx}px ${cy}px`, opacity: 0.25 + i * 0.2 }}>
                <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} strokeLinecap="round" />
                <line x1={cx - r * 0.5} y1={cy - r * 0.866} x2={cx + r * 0.5} y2={cy + r * 0.866} stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} strokeLinecap="round" />
                <line x1={cx + r * 0.5} y1={cy - r * 0.866} x2={cx - r * 0.5} y2={cy + r * 0.866} stroke="currentColor" strokeWidth={ICON_STROKE_WIDTH} strokeLinecap="round" />
              </g>
            );
          })}
        </svg>
      </span>
      <span className="transition-opacity duration-200" style={{ opacity: revealed ? 1 : 0 }}>
        {children}
      </span>
    </span>
  );
};

// Priority indicator — 6 dots orbiting a right-pointing triangle outline.
// The bright point chases the triangle clockwise: tip → upper → left → lower → tip.
// Reads as "active / locked-on" without being a circle, chevron, or spinner.
export const SidebarActiveVector: React.FC = () => {
  // Triangle pointing right: tip, upper-right, upper-left, left-mid, lower-left, lower-right
  const pts: [number,number][] = [
    [18,12],  // 0 — tip (right)
    [11,4],   // 1 — upper corner
    [4,4],    // 2 — upper-left
    [4,12],   // 3 — left mid
    [4,20],   // 4 — lower-left
    [11,20],  // 5 — lower corner
  ];
  return (
    <svg width="22" height="22" viewBox="0 0 22 24" fill="currentColor" className="text-ink/80">
      {pts.map(([cx,cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="1.4"
          style={{ animation: 'vectorFade 1.5s ease-in-out infinite', animationDelay: `${i * 0.25}s` }} />
      ))}
    </svg>
  );
};

// ─── Section icons ──────────────────────────────────────────────────────────
// Hand-drawn, like the illustrations (see scripts/illustrations): a thick ink line over a flat
// paper shape set a little off it. Each is drawn three times, slightly differently, and the
// three are flicked through four times a second, the "line boil" of a hand-drawn animation.
// Whatever the old dotted icon showed is still shown: the glass fills with the day's water,
// the stopwatch hand turns while a session runs, the clock tells the time.
// size=20 → small card   size=36 → big card corner

const Sketch: React.FC<{ layers: Layers }> = ({ layers }) => (
  <>
    {layers.map(([paper, ink], i) => (
      <React.Fragment key={i}>
        <g fill="var(--icon-paper)">{paper.map((d, j) => <path key={j} d={d} />)}</g>
        <g fill="currentColor">{ink.map((d, j) => <path key={j} d={d} />)}</g>
      </React.Fragment>
    ))}
  </>
);

/** The three redraws, one showing at a time (global.css, .sketch-boil). */
const Boil: React.FC<{ frames: readonly Layers[] }> = ({ frames }) => (
  <g className="sketch-boil-set">
    {frames.map((layers, i) => (
      <g key={i} className="sketch-boil" style={{ animationDelay: `${-i * 0.25}s` }}>
        <Sketch layers={layers} />
      </g>
    ))}
  </g>
);

const SketchSvg: React.FC<{ size: number; children: React.ReactNode }> = ({ size, children }) => (
  <svg width={size} height={size} viewBox="0 0 1000 1000" aria-hidden="true" overflow="visible">{children}</svg>
);

// WATER — a glass; fillLevel 0–1 is how full it is, and it fills on the system's spring.
// The water is the glass's inside moved (34, 30), so it spans y 166–896 and empty shows none.
export const WaterVector: React.FC<{ size?: number; fillLevel?: number }> = ({ size = 20, fillLevel = 0.5 }) => {
  const clipId = `water-${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const level = Math.min(1, Math.max(0, fillLevel));
  return (
    <SketchSvg size={size}>
      <defs>
        <clipPath id={clipId}>
          <motion.rect x={0} width={1000} height={1000} initial={false} animate={{ y: 896 - level * 730 }} transition={SPRING} />
        </clipPath>
      </defs>
      <path d={WATER_ICON.inside} fill="var(--icon-paper)" transform="translate(34 30)" clipPath={`url(#${clipId})`} />
      <Boil frames={WATER_ICON.frames} />
    </SketchSvg>
  );
};

// FOCUS — a stopwatch whose hand turns; paused=true stops it where it is.
export const FocusVector: React.FC<{ size?: number; paused?: boolean }> = ({ size = 20, paused = false }) => (
  <SketchSvg size={size}>
    <Boil frames={FOCUS_ICON.frames} />
    <g style={{ transformOrigin: '480px 540px', animation: 'focusHandSpin 9s linear infinite', animationPlayState: paused ? 'paused' : 'running' }}>
      <Boil frames={FOCUS_ICON.parts.hand} />
    </g>
  </SketchSvg>
);

// FINANCE — a coin over a small stack; the coin floats down and back, slowly.
export const FinanceVector: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <SketchSvg size={size}>
    <Boil frames={FINANCE_ICON.frames} />
    <g className="sketch-float">
      <Boil frames={FINANCE_ICON.parts.coin} />
    </g>
  </SketchSvg>
);

// TIME — a clock showing the real time, re-read every half minute.
export const TimeVector: React.FC<{ size?: number }> = ({ size = 20 }) => {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const minuteDeg = now.getMinutes() * 6;
  const hourDeg = (now.getHours() % 12) * 30 + now.getMinutes() / 2;
  return (
    <SketchSvg size={size}>
      <Boil frames={TIME_ICON.frames} />
      <g transform={`rotate(${hourDeg} 500 500)`}><Boil frames={TIME_ICON.parts.hour} /></g>
      <g transform={`rotate(${minuteDeg} 500 500)`}><Boil frames={TIME_ICON.parts.minute} /></g>
    </SketchSvg>
  );
};


// ─── Monthly Fingerprint ────────────────────────────────────────────────────
export const MonthFingerprint: React.FC<{
  monthKey: string;
  days: Record<string, { water: number; focus: number; workout: number }>;
  size?: number;
}> = ({ monthKey, days, size = 72 }) => {
  const cx = size / 2, cy = size / 2, maxR = size * 0.44;
  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      {Array.from({ length: daysInMonth }, (_, i) => {
        const dateKey = `${monthKey}-${String(i + 1).padStart(2, '0')}`;
        const d = days[dateKey] ?? null;
        const angle = (i / daysInMonth) * Math.PI * 2 - Math.PI / 2;
        const score = d ? Math.min(1, d.water / 12 * 0.4 + d.focus / 100 * 0.4 + (d.workout > 0 ? 1 : 0) * 0.2) : 0;
        const r = score > 0 ? maxR * (0.3 + score * 0.7) : maxR * 0.08;
        const x2 = cx + Math.cos(angle) * r;
        const y2 = cy + Math.sin(angle) * r;
        return (
          <line key={i} x1={cx} y1={cy} x2={x2} y2={y2}
            stroke="currentColor"
            strokeWidth={score > 0.5 ? 1.6 : 1}
            opacity={score > 0 ? 0.3 + score * 0.65 : 0.1} />
        );
      })}
    </svg>
  );
};
