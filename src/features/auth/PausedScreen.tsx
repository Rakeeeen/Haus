import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/ui/Button';
import { HourglassFace } from '@/ui/HourglassFace';
import { Wordmark } from '@/ui/Wordmark';
import { SPRING } from '@/ui/springPose';

/** How long the sand takes to run from one chamber to the other, in seconds; then the glass turns over and it runs back. */
const RUN_SECONDS = 9;

/** The sand's place for the hourglass, driven a second at a time (the glass eases each step on its own). */
function useRunningSand(still: boolean) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (still) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [still]);
  if (still) return { mode: 'focus' as const, upper: 0.5, lower: 0.5 };
  const round = Math.floor(tick / RUN_SECONDS);
  const p = (tick % RUN_SECONDS) / RUN_SECONDS;
  // Upright the sand runs from the upper chamber down; turned over, the lower one is on top and runs the other way.
  return round % 2 === 0
    ? { mode: 'focus' as const, upper: 1 - p, lower: p }
    : { mode: 'break' as const, upper: p, lower: 1 - p };
}

const Ring: React.FC<{ delay: number; still: boolean }> = ({ delay, still }) => (
  <motion.span
    aria-hidden
    className="absolute inset-0 m-auto rounded-full border border-ink/25"
    style={{ width: 180, height: 180 }}
    initial={{ scale: 0.7, opacity: 0 }}
    animate={still ? { scale: 1, opacity: 0.12 } : { scale: [0.7, 1.9], opacity: [0.35, 0] }}
    transition={still ? { duration: 0 } : { duration: 5, delay, repeat: Infinity, ease: 'easeOut' }}
  />
);

const Mote: React.FC<{ left: string; delay: number; size: number; still: boolean }> = ({ left, delay, size, still }) => (
  <motion.span
    aria-hidden
    className="absolute bottom-6 rounded-full bg-ink/30"
    style={{ left, width: size, height: size }}
    initial={{ y: 0, opacity: 0 }}
    animate={still ? { opacity: 0 } : { y: [-4, -170], opacity: [0, 0.5, 0] }}
    transition={still ? { duration: 0 } : { duration: 7, delay, repeat: Infinity, ease: 'easeOut' }}
  />
);

/**
 * What a guest sees while Hamed has paused Haus: a calm page, not an error. The hourglass runs and turns over on its own, soft rings
 * breathe out from it and a few motes drift up. Nothing to press but "Sign out": the moment he switches Haus back on, the page
 * this replaces comes back by itself (the pause switch is watched live). `message` is his own note, if he left one.
 */
export const PausedScreen: React.FC<{ message?: string; onSignOut: () => void }> = ({ message = '', onSignOut }) => {
  const reduced = !!useReducedMotion();
  const sand = useRunningSand(reduced);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" role="status" aria-live="polite">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={SPRING}
        className="relative w-full max-w-md card p-10 md:p-12 text-center overflow-hidden"
      >
        <p className="font-mono-main text-[10px] uppercase tracking-[0.3em] text-ink/40 mb-6">
          <Wordmark />
        </p>

        <div className="relative mx-auto mb-8 flex items-center justify-center text-ink" style={{ width: 220, height: 220 }}>
          <Ring delay={0} still={reduced} />
          <Ring delay={1.7} still={reduced} />
          <Ring delay={3.4} still={reduced} />
          <Mote left="30%" delay={0} size={4} still={reduced} />
          <Mote left="52%" delay={2.2} size={3} still={reduced} />
          <Mote left="68%" delay={4.4} size={5} still={reduced} />
          <motion.div
            className="relative"
            animate={reduced ? undefined : { y: [0, -6, 0] }}
            transition={reduced ? undefined : { duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <HourglassFace upper={sand.upper} lower={sand.lower} mode={sand.mode} running={!reduced} overtime={false} size={150} />
          </motion.div>
        </div>

        <h1 className="text-silver mx-auto text-3xl font-black uppercase tracking-tight mb-4">Taking a breath</h1>
        <p dir="auto" className="font-mono-main text-[12px] leading-relaxed text-ink/60 mb-2">
          {message || 'Hamed has paused Haus for a moment. Nothing is lost.'}
        </p>
        <p className="font-mono-main text-[11px] leading-relaxed text-ink/40 mb-8">
          Stay on this page — it opens by itself the moment he switches Haus back on.
        </p>

        <div className="flex items-center justify-center gap-2 mb-8" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-ink/50"
              animate={reduced ? { opacity: 0.5 } : { opacity: [0.2, 1, 0.2], y: [0, -3, 0] }}
              transition={reduced ? { duration: 0 } : { duration: 1.4, delay: i * 0.22, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}
        </div>

        <Button tone="ghost" size="sm" onClick={onSignOut}>Sign out</Button>
      </motion.div>
    </div>
  );
};
