/** What the Tasks card says when there is nothing left to do — nothing today and nothing left behind. Light and a little silly on purpose. */
export const CHEERS: readonly string[] = [
  "Inbox zero's cousin: task list zero.",
  "All done. The list is now just a list.",
  "You, one. Tasks, zero.",
  "Even procrastination has nothing to say.",
  "Task list cleared. Please do not look for more.",
  "Plot twist: you finished everything.",
  "The to-do list has left the chat.",
  "Nothing left. Suspicious, but we'll take it.",
  "You absolute finisher.",
  "Done. Go stare out of a window like a champion.",
  "All ticked. The ticks are getting emotional.",
  "Your list called in sick. Permanently.",
  "Zero tasks. Zero worries. Some snacks, maybe.",
  "You've run out of things to do. Terrible problem to have.",
  "Everything's done. Act casual.",
  "Look at you, being all finished.",
  "Cleared the board. Nobody saw it coming. Except you.",
  "The tasks surrendered.",
  "Nothing due. The calendar is shook.",
  "Done and dusted. Mostly done. Fully done, actually.",
  "Your future self just sent a thank-you note.",
  "That's it. The list ran out of ideas.",
  "All finished. Time to be insufferably relaxed.",
  "No tasks found. Enjoy the 404.",
  "Congratulations, you have outworked your own list.",
  "Tasks: defeated. Couch: undefeated.",
  "The list is empty, like a good dessert plate.",
  "Not a single task. You did that.",
  "Cancel the alarms, the list is clear.",
  "You vs. the list: a decisive victory.",
  "Finished everything and still look this good.",
  "Productivity level: suspiciously high.",
  "The only thing left to do is nothing. Do it well.",
  "Nobody's chasing you. Sprint optional, walking encouraged.",
  "All done. Your chair deserves a medal too.",
  "Cleared it all. Humble about it, obviously.",
  "Task list: empty. Vibes: full.",
  "You just did a thing, then the next thing, then all the things.",
  "And the crowd goes quiet. Because there's nothing left.",
  "Tick, tick, done. Like a tiny victory lap.",
  "Everything's done. Tell no one, enjoy everything.",
  "Your list is now a blank page. Stay out of trouble.",
  "Nothing left. Go pet something.",
  "The to-do list is out of work.",
  "You did the hard thing and then all the other things.",
  "A flawless finish. The judges are crying.",
  "Empty list. Open day. Questionable choices available.",
  "No more ticks to tick. Tragic, really.",
  "Done. Tea, nap, or both. We don't judge.",
  "Everything's finished. The universe nods quietly.",
];

/**
 * A shuffled pile of the sentences: each one shows once before any shows again, and after the last the pile is shuffled
 * afresh (never starting with the one just shown). `remaining` is what is left in the pile, `current` what is shown now.
 */
export interface CheerBag { remaining: number[]; current: number }

const shuffled = (n: number, random: () => number): number[] => {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
};

/** The next sentence: pulls from the pile, reshuffling it first when it has run out. */
export function drawCheer(bag: CheerBag | null, random: () => number = Math.random, count: number = CHEERS.length): CheerBag {
  let remaining = bag?.remaining ?? [];
  if (remaining.length === 0) {
    remaining = shuffled(count, random);
    // The same sentence twice in a row, across a reshuffle, would look like nothing changed.
    if (bag && remaining.length > 1 && remaining[0] === bag.current) [remaining[0], remaining[remaining.length - 1]] = [remaining[remaining.length - 1], remaining[0]];
  }
  const [current, ...rest] = remaining;
  return { remaining: rest, current };
}

/** A pile read back from storage, or null if it isn't one this list can use (a shorter list, a damaged value). */
export function validBag(value: unknown, count: number = CHEERS.length): CheerBag | null {
  const bag = value as Partial<CheerBag> | null;
  const ok = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) < count;
  return bag && ok(bag.current) && Array.isArray(bag.remaining) && bag.remaining.every(ok) ? (bag as CheerBag) : null;
}
