import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { ClockParts } from '@/domain/clock';
import { PixelDigits } from '@/ui/PixelFocusDisplay';
import { dockPose, SPRING } from '@/ui/springPose';
import { MaskedValue, SidebarActiveVector } from '@/features/home/components/visuals';
import type { CardId } from '@/features/home/useCardSelection';
import type { DockTouch } from '@/features/home/useDockTouch';

/** One small card of the dock. */
export interface DockCard {
  id: CardId;
  title: string;
  Vector: React.ComponentType<{ size?: number; fillLevel?: number; paused?: boolean }>;
  /** The page a double click opens (Water logs a glass instead). */
  route: string | null;
  /** The big number; null for Time, which draws its own dotted digits. */
  metric: string | null;
  subText: string;
}

const CARD_HEIGHT = 124;
const CARD_GAP = 16;
const ARROW_HEIGHT = 22;

/**
 * The left stack of small cards ("stage manager"): the one in use is solid, the rest an outline over the page. Cards push
 * their neighbours when touched, and one shared arrow springs to whichever card the system is showing. In zen mode the whole
 * stack collapses away. `dockRef` is on the inner, always full-width element, so its height keeps being measured (the big
 * card matches it) whatever the collapsed wrapper clips it to.
 */
export const Dock: React.FC<{
  cards: DockCard[];
  activeCardId: CardId;
  /** The card with system priority; the arrow points at it. */
  systemCardId: CardId | null;
  zenActive: boolean;
  isLgUp: boolean;
  /** How far the dock shifts when the big card is touched. */
  dockShift: number;
  touch: DockTouch;
  dockRef: React.RefObject<HTMLDivElement>;
  waterFillLevel: number;
  clock: ClockParts;
  totalPhysical: number;
  onPick: (id: CardId) => void;
  /** Double click: Water logs a glass, the others open their page. */
  onOpen: (card: DockCard, e: React.MouseEvent) => void;
}> = ({ cards, activeCardId, systemCardId, zenActive, isLgUp, dockShift, touch, dockRef, waterFillLevel, clock, totalPhysical, onPick, onOpen }) => {
  const reduceMotion = useReducedMotion();
  const { hoveredCardId, setHoveredCardId, pressedCardId, pressCard, releaseCard } = touch;

  return (
    // The outer wrapper is what animates and clips. Width AND a matching negative margin animate together (framer-motion
    // won't reliably animate the row's own `gap`), so the big card reaches the header's right edge, not just where the dock began.
    <motion.div
      className="shrink-0"
      initial={false}
      animate={isLgUp ? { width: zenActive ? 0 : 230, marginRight: zenActive ? -32 : 0 } : undefined}
      transition={SPRING}
      style={{ overflowX: isLgUp ? (zenActive ? 'hidden' : 'visible') : 'auto', overflowY: 'visible' }}
    >
      <motion.div
        ref={dockRef}
        className="relative flex lg:flex-col pb-3 lg:pb-0 w-max lg:w-[230px] -mx-6 px-6 lg:mx-0 lg:px-0"
        initial={false}
        animate={{ x: isLgUp ? dockShift : 0 }}
        transition={SPRING}
      >
        <div
          className="flex lg:flex-col gap-3 lg:gap-4"
          style={{ opacity: zenActive ? 0 : 1, pointerEvents: zenActive ? 'none' : 'auto', transition: 'opacity 350ms ease' }}
        >
          {cards.map((card, index) => {
            const isActive = activeCardId === card.id;
            const { Vector } = card;
            const touchedId = reduceMotion ? null : pressedCardId ?? hoveredCardId;
            const touchedIndex = touchedId ? cards.findIndex((c) => c.id === touchedId) : -1;
            const pose = dockPose(index, touchedIndex < 0 ? null : touchedIndex, pressedCardId ? 'press' : 'hover', isLgUp);
            return (
              <motion.div
                key={card.id}
                initial={false}
                animate={isLgUp ? { x: 0, y: pose.shift } : { x: pose.shift, y: 0 }}
                transition={SPRING}
                onPointerDown={() => pressCard(card.id)}
                onPointerUp={releaseCard}
                onPointerCancel={releaseCard}
                onClick={() => onPick(card.id)}
                onDoubleClick={(e) => onOpen(card, e)}
                onMouseEnter={() => setHoveredCardId(card.id)}
                onMouseLeave={() => { setHoveredCardId(null); if (pressedCardId) releaseCard(); }}
                className="cursor-pointer relative select-none w-[160px] lg:w-[230px] h-[112px] lg:h-[124px] shrink-0"
                style={{ zIndex: touchedId === card.id ? 1 : 0 }}
              >
                {/* The slot above keeps the dock's layout; this surface is what stretches, so its edges can move without
                    touching the text's size. */}
                <motion.div
                  data-active={isActive || undefined}
                  initial={false}
                  animate={{ top: -pose.edges.top, right: -pose.edges.right, bottom: -pose.edges.bottom, left: -pose.edges.left }}
                  transition={SPRING}
                  // Only the card in use is solid. The rest are an outline over the page, so the eye has one place to land.
                  className={`absolute flex flex-col justify-between p-4 border rounded-card ${
                    isActive
                      ? 'bg-paper-dark border-ink text-ink'
                      : 'bg-transparent border-dashed border-ink/30 text-ink/55 hover:text-ink hover:border-ink/50'
                  }`}
                  style={{ transition: 'border-color 200ms ease, color 200ms ease, background-color 200ms ease' }}
                >
                  <div className="flex justify-between items-start pointer-events-none">
                    <span className="font-sans-main text-xs font-black tracking-tight uppercase truncate mr-2">{card.title}</span>
                    <div className="shrink-0 text-ink" style={{ opacity: isActive || hoveredCardId === card.id ? 1 : 0, transition: 'opacity 0.6s ease' }}>
                      <Vector {...(card.id === 'water' ? { fillLevel: waterFillLevel } : {})} {...(card.id === 'pomodoro' ? { paused: false } : {})} />
                    </div>
                  </div>
                  <div className="mt-1 pointer-events-none">
                    {card.id === 'time' ? (
                      <span className="flex items-end gap-1.5 h-6 lg:h-[27px] pb-[5px]">
                        <PixelDigits mm={clock.hour} ss={clock.minute} color="var(--ink)" height="14px" flush />
                        <span className="font-mono-main text-[9px] font-bold leading-none">{clock.period}</span>
                      </span>
                    ) : (
                      <span className="font-mono-main text-[16px] lg:text-[18px] font-black block truncate">
                        {card.id === 'finance' && totalPhysical > 0 ? <MaskedValue>{card.metric}</MaskedValue> : card.metric}
                      </span>
                    )}
                    <span className={`font-mono-main text-[8px] lg:text-[9px] tracking-wider font-bold uppercase block truncate ${isActive ? 'text-ink/50' : 'text-ink/40'}`}>
                      {card.subText}
                    </span>
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        {/* Priority arrow — one shared element that springs from card to card instead of popping in and out, so the eye can track
            it. Its position is computed (card index × card height + gap), not layoutId-based: the dock is a row on mobile and a
            column on desktop, and the arrow only ever needs the desktop column's maths. */}
        {systemCardId && !zenActive && (
          <motion.div
            className="hidden lg:block absolute -left-10 z-10 pointer-events-none"
            style={{ top: 0 }}
            animate={{ y: (CARD_HEIGHT - ARROW_HEIGHT) / 2 + cards.findIndex((c) => c.id === systemCardId) * (CARD_HEIGHT + CARD_GAP), opacity: 1 }}
            initial={false}
            transition={SPRING}
          >
            <SidebarActiveVector />
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
};
