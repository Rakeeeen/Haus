/**
 * The system's one physical motion. Things have weight and push on each other, like Material 3
 * Expressive's button groups, but settle gently, like Apple's springs. Stiffness sits between
 * Material's slow (200) and default (380) spatial springs, at about Apple's 0.4s pacing and 0.28
 * bounce, under the 0.4 where Apple says it starts to feel exaggerated.
 *
 * Only position and size use it. Colour and opacity never overshoot, so they keep plain easing.
 * The same curve for CSS is --spring in global.css.
 */
export const SPRING = { type: 'spring', stiffness: 240, damping: 22.3, mass: 1 } as const;

/** Long enough for a quick tap to show: Material holds a press until it is 75% of the way there. */
export const MIN_PRESS_MS = 140;

export type SpringPhase = 'hover' | 'press';

/** How far each neighbour yields, in px, by distance from the touched item. It fades with distance. */
const PUSH: Record<SpringPhase, readonly number[]> = {
  hover: [2, 1, 0.4],
  press: [5, 2.5, 1],
};
const GROWTH: Record<SpringPhase, number> = { hover: 1.012, press: 1.04 };

/** The big card weighs more: it grows less for its size but moves everything around it. */
const STAGE_GROWTH: Record<SpringPhase, number> = { hover: 1.01, press: 1.02 };
const STAGE_PUSH: Record<SpringPhase, number> = { hover: 6, press: 10 };
const DOCK_PUSH: Record<SpringPhase, number> = { hover: 2, press: 4 };

/**
 * The big card and the dock beside it, as neighbours. Touching the big card grows it and pushes
 * the dock left and the date below down; touching a dock card nudges the big card right.
 */
export function stagePose(stage: SpringPhase | null, dock: SpringPhase | null) {
  const push = stage ? STAGE_PUSH[stage] : 0;
  return {
    scale: stage ? STAGE_GROWTH[stage] : 1,
    stageShift: dock ? DOCK_PUSH[dock] : 0,
    dockShift: push ? -push : 0,
    footerShift: push / 2,
  };
}

/**
 * Where an item in a row or stack sits while another one is touched: the touched item grows and
 * the items beside it are pushed away from it.
 */
export function springPose(
  index: number,
  touchedIndex: number | null,
  phase: SpringPhase,
): { scale: number; shift: number } {
  if (touchedIndex === null) return { scale: 1, shift: 0 };
  if (index === touchedIndex) return { scale: GROWTH[phase], shift: 0 };
  const distance = Math.abs(index - touchedIndex);
  return { scale: 1, shift: Math.sign(index - touchedIndex) * (PUSH[phase][distance - 1] ?? 0) };
}
