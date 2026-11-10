/**
 * The two sounds the focus timer makes: one when a focus session's time is up, one when a break is over. Short, soft and
 * rounded — a pair of notes that rise (time to rest) or fall (back to it), not a bell — in the key of A so they sit
 * together. Pure data: lib/audio.ts plays them.
 */
export interface ChimeNote {
  /** Seconds after the chime starts. */
  at: number;
  hz: number;
  /** How long the note rings out, in seconds. */
  length: number;
  /** 0–1, before the master volume. */
  gain: number;
}

export type ChimeName = 'focusEnd' | 'breakEnd';

const SEMITONE_FROM_A: Record<string, number> = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };

/** A note's pitch in Hz, equal temperament with A4 = 440: noteHz('A4') is 440, noteHz('E5') is 659.26. */
export function noteHz(note: string): number {
  const match = /^([A-G]#?)(-?\d)$/.exec(note);
  if (!match) throw new Error(`Not a note: ${note}`);
  const semitones = SEMITONE_FROM_A[match[1]] + (Number(match[2]) - 4) * 12;
  return 440 * 2 ** (semitones / 12);
}

const n = (name: string, at: number, length: number, gain: number): ChimeNote => ({ at, hz: noteHz(name), length, gain });

export const CHIMES: Record<ChimeName, readonly ChimeNote[]> = {
  // Time's up: A up to E, a fifth, the second note a little brighter and longer.
  focusEnd: [n('A5', 0, 1.1, 0.5), n('E6', 0.14, 1.6, 0.55)],
  // Break over: E down to A, quieter, ending low.
  breakEnd: [n('E6', 0, 0.9, 0.4), n('A5', 0.16, 1.5, 0.45)],
};

/** How long a chime lasts from its start to when its last note has died away. */
export const chimeDuration = (chime: readonly ChimeNote[]): number => Math.max(...chime.map((c) => c.at + c.length));
