/**
 * The system's one physical motion. Things have weight and push on each other, like Material 3
 * Expressive's button groups, but settle gently, like Apple's springs. Stiffness sits between
 * Material's slow (200) and default (380) spatial springs, at about Apple's 0.4s pacing and 0.28
 * bounce, under the 0.4 where Apple says it starts to feel exaggerated.
 *
 * Nothing zooms. A touched thing stretches only towards what is next to it, so its text stays
 * still and sharp, and what it reaches yields. Only position and size use the spring: colour and
 * opacity never overshoot, so they keep plain easing. The same curve for CSS is --spring in
 * global.css.
 */
export const SPRING = { type: 'spring', stiffness: 240, damping: 22.3, mass: 1 } as const;

/** Long enough for a quick tap to show: Material holds a press until it is 75% of the way there. */
export const MIN_PRESS_MS = 140;

export type SpringPhase = 'hover' | 'press';

/** How far each edge reaches out, in px. Negative pulls it in. */
export interface Edges { top: number; right: number; bottom: number; left: number }

const REST: Edges = { top: 0, right: 0, bottom: 0, left: 0 };

/** Towards the dock's other cards, and towards the big card across from them. */
const DOCK_REACH: Record<SpringPhase, { along: number; across: number }> = {
  hover: { along: 2, across: 4 },
  press: { along: 5, across: 8 },
};
/** How far each neighbour yields, by distance from the touched card. It fades with distance. */
const DOCK_PUSH: Record<SpringPhase, readonly number[]> = {
  hover: [2, 1, 0.4],
  press: [5, 2.5, 1],
};
const STAGE_REACH: Record<SpringPhase, { side: number; vertical: number }> = {
  hover: { side: 6, vertical: 3 },
  press: { side: 10, vertical: 5 },
};

/**
 * A dock card and where it sits while another one is touched. `stacked` is the desktop column:
 * the cards reach up, down and right, never left, where nothing is. On a phone they sit in a row
 * above the big card, so they reach left, right and down.
 */
export function dockPose(
  index: number,
  touchedIndex: number | null,
  phase: SpringPhase,
  stacked: boolean,
): { edges: Edges; shift: number } {
  if (touchedIndex === null) return { edges: REST, shift: 0 };
  if (index === touchedIndex) {
    const { along, across } = DOCK_REACH[phase];
    return {
      edges: stacked
        ? { top: along, right: across, bottom: along, left: 0 }
        : { top: 0, right: along, bottom: across, left: along },
      shift: 0,
    };
  }
  const distance = Math.abs(index - touchedIndex);
  return { edges: REST, shift: Math.sign(index - touchedIndex) * (DOCK_PUSH[phase][distance - 1] ?? 0) };
}

/**
 * The big card, and what it does to the dock and the date. Touched, it reaches towards them and
 * pushes them away; its right edge is the page's, so it stays. When a dock card reaches for it,
 * the near edge gives way instead of the whole card sliding.
 */
export function stagePose(stage: SpringPhase | null, dock: SpringPhase | null, beside: boolean) {
  const give = dock ? DOCK_REACH[dock].across : 0;
  const reach = stage ? STAGE_REACH[stage] : { side: 0, vertical: 0 };
  return {
    edges: beside
      ? { top: reach.vertical, right: 0, bottom: reach.vertical, left: reach.side - give }
      : { top: 0 - give, right: 0, bottom: reach.vertical, left: 0 },
    dockShift: beside ? 0 - reach.side : 0,
    footerShift: reach.vertical,
  };
}
