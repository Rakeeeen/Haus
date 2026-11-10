import { describe, it, expect } from 'vitest';
import { CHIMES, chimeDuration, noteHz } from '@/domain/focus/chimes';

describe('noteHz', () => {
  it('is 440 for A4 and doubles each octave', () => {
    expect(noteHz('A4')).toBeCloseTo(440, 5);
    expect(noteHz('A5')).toBeCloseTo(880, 5);
    expect(noteHz('A3')).toBeCloseTo(220, 5);
  });
  it('knows the notes around it', () => {
    expect(noteHz('E5')).toBeCloseTo(659.26, 1);
    expect(noteHz('C4')).toBeCloseTo(261.63, 1);
    expect(noteHz('A#4')).toBeCloseTo(466.16, 1);
  });
  it('refuses what is not a note', () => {
    expect(() => noteHz('H4')).toThrow();
    expect(() => noteHz('A')).toThrow();
  });
});

describe('CHIMES', () => {
  it('has a chime for each end, notes in order of time, each a sound that can be heard', () => {
    for (const chime of Object.values(CHIMES)) {
      expect(chime.length).toBeGreaterThan(0);
      expect(chime.map((c) => c.at)).toEqual([...chime.map((c) => c.at)].sort((a, b) => a - b));
      for (const note of chime) {
        expect(note.hz).toBeGreaterThan(100);
        expect(note.hz).toBeLessThan(4000);
        expect(note.gain).toBeGreaterThan(0);
        expect(note.gain).toBeLessThanOrEqual(1);
        expect(note.length).toBeGreaterThan(0);
      }
    }
  });
  it('rises when time is up and falls when the break is over', () => {
    const [first, second] = CHIMES.focusEnd;
    expect(second.hz).toBeGreaterThan(first.hz);
    const [a, b] = CHIMES.breakEnd;
    expect(b.hz).toBeLessThan(a.hz);
  });
  it('stays short', () => {
    for (const chime of Object.values(CHIMES)) expect(chimeDuration(chime)).toBeLessThan(2.5);
  });
});
