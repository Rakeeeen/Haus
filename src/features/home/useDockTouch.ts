import { useRef, useState } from 'react';
import { MIN_PRESS_MS, type SpringPhase } from '@/ui/springPose';

/**
 * What the pointer is doing to the dock and the big card: which small card is hovered or pressed, and whether the big card
 * is. They share this because the cards push each other — and the big card — when one is touched.
 */
export function useDockTouch() {
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [pressedCardId, setPressedCardId] = useState<string | null>(null);
  const [stageTouch, setStageTouch] = useState<SpringPhase | null>(null);
  const pressedAtRef = useRef(0);

  const pressCard = (id: string) => { pressedAtRef.current = Date.now(); setPressedCardId(id); };
  // Held briefly, so a quick tap still gets its push instead of ending before it shows.
  const releaseCard = () => {
    const held = Date.now() - pressedAtRef.current;
    window.setTimeout(() => setPressedCardId(null), Math.max(0, MIN_PRESS_MS - held));
  };

  return { hoveredCardId, setHoveredCardId, pressedCardId, pressCard, releaseCard, stageTouch, setStageTouch };
}

export type DockTouch = ReturnType<typeof useDockTouch>;
