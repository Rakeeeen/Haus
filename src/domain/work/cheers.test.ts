import { describe, it, expect } from 'vitest';
import { CHEERS, drawCheer, validBag, type CheerBag } from '@/domain/work/cheers';

const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

describe('CHEERS', () => {
  it('has fifty different sentences', () => {
    expect(CHEERS).toHaveLength(50);
    expect(new Set(CHEERS).size).toBe(50);
  });
});

describe('drawCheer', () => {
  it('shows every sentence once before any repeats', () => {
    const random = seeded(7);
    let bag: CheerBag | null = null;
    const seen: number[] = [];
    for (let i = 0; i < 50; i++) { bag = drawCheer(bag, random); seen.push(bag.current); }
    expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => i));
  });

  it('reshuffles afterwards in a new order, never starting with the sentence just shown', () => {
    const random = seeded(3);
    let bag: CheerBag | null = null;
    const first: number[] = [], second: number[] = [];
    for (let i = 0; i < 50; i++) { bag = drawCheer(bag, random); first.push(bag.current); }
    for (let i = 0; i < 50; i++) { bag = drawCheer(bag, random); second.push(bag.current); }
    expect(second).not.toEqual(first);
    expect(second[0]).not.toBe(first[49]);
    expect(new Set(second).size).toBe(50);
  });

  it('never shows the same sentence twice in a row, even with a stubborn random', () => {
    let bag: CheerBag | null = null;
    let last = -1;
    for (let i = 0; i < 120; i++) { bag = drawCheer(bag, () => 0); expect(bag.current).not.toBe(last); last = bag.current; }
  });
});

describe('validBag', () => {
  it('accepts a real pile and rejects the rest', () => {
    expect(validBag({ remaining: [1, 2], current: 3 })).toEqual({ remaining: [1, 2], current: 3 });
    expect(validBag({ remaining: [1, 99], current: 3 })).toBeNull();
    expect(validBag({ remaining: 'x', current: 3 })).toBeNull();
    expect(validBag(null)).toBeNull();
  });
});
