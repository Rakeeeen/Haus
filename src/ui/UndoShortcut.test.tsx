// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UndoShortcut } from '@/ui/UndoShortcut';
import { pushUndo, resetUndoForTests, valueStep } from '@/lib/undoStack';

let value = 1;
const set = (v: number) => { value = v; };
beforeEach(() => { value = 9; resetUndoForTests(); pushUndo({ label: 'a change', undo: valueStep(set, 9, 1) }); });
afterEach(() => resetUndoForTests());

const key = async (init: KeyboardEventInit, target: Element | Document = document) => {
  await act(async () => { fireEvent.keyDown(target, init); });
  await act(async () => { await Promise.resolve(); });
};

describe('UndoShortcut', () => {
  it('⌘Z undoes, ⌘⇧Z redoes, and says what it did', async () => {
    render(<UndoShortcut />);
    await key({ key: 'z', metaKey: true });
    expect(value).toBe(1);
    expect(screen.getByRole('status').textContent).toContain('Undid');
    expect(screen.getByRole('status').textContent).toContain('a change');
    await key({ key: 'z', metaKey: true, shiftKey: true });
    expect(value).toBe(9);
    const last = screen.getAllByRole('status').slice(-1)[0].textContent;
    expect(last).toContain('Redid');
    expect(last).toContain('a change');
  });

  it('Ctrl+Z undoes and Ctrl+Y redoes', async () => {
    render(<UndoShortcut />);
    await key({ key: 'z', ctrlKey: true });
    expect(value).toBe(1);
    await key({ key: 'y', ctrlKey: true });
    expect(value).toBe(9);
  });

  it("leaves a text field's own undo alone", async () => {
    render(<><UndoShortcut /><input aria-label="note" /></>);
    await key({ key: 'z', metaKey: true }, screen.getByLabelText('note'));
    expect(value).toBe(9);
  });

  it('leaves it alone while a dialog is open', async () => {
    render(<><UndoShortcut /><div role="dialog" /></>);
    await key({ key: 'z', metaKey: true });
    expect(value).toBe(9);
  });
});
