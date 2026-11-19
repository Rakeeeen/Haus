import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dropUndo, pushUndo, redoLast, resetUndoForTests, setUndoFallback, undoLast, valueStep } from '@/lib/undoStack';

beforeEach(() => resetUndoForTests());

describe('undoLast', () => {
  it('undoes the newest first, one at a time', async () => {
    const order: string[] = [];
    pushUndo({ label: 'one', undo: () => { order.push('one'); } });
    pushUndo({ label: 'two', undo: async () => { order.push('two'); } });
    await undoLast();
    await undoLast();
    expect(order).toEqual(['two', 'one']);
  });

  it('says there is nothing when there is nothing, and does not throw', async () => {
    expect(await undoLast()).toBe(false);
  });

  it('survives an undo that fails, and moves on to the next one', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    pushUndo({ label: 'fine', undo: () => {} });
    pushUndo({ label: 'broken', undo: () => { throw new Error('no'); } });
    expect(await undoLast()).toBe(false);
    expect(await undoLast()).toBe(true);
    warn.mockRestore();
  });

  it('asks the fallback when the pile is empty', async () => {
    setUndoFallback(async () => 'Brought back a task');
    expect(await undoLast()).toBe(true);
  });
});

describe('redo', () => {
  it('a real pair: undo puts the old value back, redo the new one, undo the old again', async () => {
    let value = 5;
    const set = (v: number) => { value = v; };
    pushUndo({ label: 'changed 5 → 9', undo: valueStep(set, 9, 5) });   // the change is already made: 9 now
    value = 9;
    await undoLast();
    expect(value).toBe(5);
    await redoLast();
    expect(value).toBe(9);
    await undoLast();
    expect(value).toBe(5);
  });

  it('is emptied by doing something new', async () => {
    let value = 0;
    const set = (v: number) => { value = v; };
    pushUndo({ label: 'a', undo: valueStep(set, 1, 0) });
    await undoLast();
    pushUndo({ label: 'b', undo: () => {} });
    expect(await redoLast()).toBe(false);
    expect(value).toBe(0);
  });

  it('says there is nothing to redo', async () => {
    expect(await redoLast()).toBe(false);
  });
});

describe('dropUndo', () => {
  it('forgets an entry that was dealt with another way', async () => {
    const undo = vi.fn();
    const entry = pushUndo({ label: 'x', undo });
    dropUndo(entry);
    await undoLast();
    expect(undo).not.toHaveBeenCalled();
  });
});
