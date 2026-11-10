import React from 'react';
import { motion } from 'framer-motion';
import { MIN_PRESS_MS, SPRING, type stagePose } from '@/ui/springPose';
import type { DockTouch } from '@/features/home/useDockTouch';

/**
 * The big card (the "stage"): it matches the dock's height — or, in zen mode, grows to the full column height the collapsed
 * dock and hidden date leave — and shows whichever card's body it is given. It is a plain CSS height transition, not
 * framer-motion's `animate` on `height`, which silently refused to commit value changes here (state updated, the rendered
 * height never followed). `--spring` is the system's spring, sampled for CSS.
 */
export const BigCard: React.FC<{
  stage: ReturnType<typeof stagePose>;
  isLgUp: boolean;
  /** The height to take at the lg breakpoint (below it the card uses its own min-height). */
  height: number;
  /** False until the dock's first real measurement has settled: that first correction snaps instead of animating. */
  animateHeight: boolean;
  touch: DockTouch;
  /** Zen mode: an invisible strip on the left edge brings the dock back when hovered (once armed). */
  zenActive: boolean;
  zenEdgeArmed: boolean;
  onExitZen: () => void;
  /** The card body is faded out while it changes. */
  visible: boolean;
  /** Clicking the card opens the page of the card it shows. */
  onOpen: () => void;
  children: React.ReactNode;
}> = ({ stage, isLgUp, height, animateHeight, touch, zenActive, zenEdgeArmed, onExitZen, visible, onOpen, children }) => (
  <div
    className="flex-1 flex flex-col items-stretch min-h-[280px] lg:min-h-0"
    style={isLgUp ? { height, transition: animateHeight ? 'height var(--spring-duration) var(--spring)' : 'none' } : undefined}
  >
    <motion.div
      initial={false}
      animate={{ marginTop: -stage.edges.top, marginBottom: -stage.edges.bottom, marginLeft: -stage.edges.left }}
      transition={SPRING}
      onMouseEnter={() => touch.setStageTouch('hover')}
      onMouseLeave={() => touch.setStageTouch(null)}
      onPointerDown={(e) => { if (!(e.target as Element).closest('button')) touch.setStageTouch('press'); }}
      onPointerUp={() => window.setTimeout(() => touch.setStageTouch((t) => (t === 'press' ? 'hover' : t)), MIN_PRESS_MS)}
      onClick={onOpen}
      className="flex-1 flex flex-col justify-between card p-5 sm:p-8 lg:p-10 relative group cursor-pointer"
    >
      {zenActive && (
        <div
          className="absolute inset-y-0 left-0 w-10 z-10"
          onMouseEnter={zenEdgeArmed ? onExitZen : undefined}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <div className="flex-1 flex flex-col" style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.2s ease' }}>
        {children}
      </div>
    </motion.div>
  </div>
);
