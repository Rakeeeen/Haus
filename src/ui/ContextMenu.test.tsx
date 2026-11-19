// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContextMenu, type MenuItem } from '@/ui/ContextMenu';

const setup = () => {
  const onClose = vi.fn(), onPick = vi.fn(), onSelect = vi.fn();
  const items: MenuItem[] = [
    { kind: 'item', label: 'Open', onSelect },
    { kind: 'submenu', label: 'Status', value: 'To do', options: [{ value: 'todo', label: 'To do', active: true }, { value: 'done', label: 'Done' }], onPick },
    { kind: 'submenu', label: 'Priority', value: 'High', options: [{ value: 'high', label: 'High', active: true }, { value: 'low', label: 'Low' }], onPick },
  ];
  const view = render(<div><p>outside</p><ContextMenu at={{ x: 40, y: 40 }} items={items} onClose={onClose} /></div>);
  return { onClose, onPick, onSelect, ...view };
};
const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 30)); }); };

describe('ContextMenu', () => {
  it('opens its list when a line with one is clicked, and the menu stays open', async () => {
    const { onClose } = setup();
    await settle();
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: /Status/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Status/ }));
    await settle();
    expect(screen.getAllByRole('menu')).toHaveLength(2);
    expect(screen.getByRole('menuitemradio', { name: /Done/ })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('still takes a second click on the same line, and a click on another line, without closing', async () => {
    const { onClose } = setup();
    await settle();
    for (const name of [/Status/, /Status/, /Priority/, /Status/]) {
      fireEvent.mouseDown(screen.getByRole('menuitem', { name }));
      fireEvent.click(screen.getByRole('menuitem', { name }));
      await settle();
    }
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('menuitemradio', { name: /Done/ })).toBeTruthy();   // the list of the line last clicked
  });

  it('shows each line its own list', async () => {
    setup();
    await settle();
    fireEvent.click(screen.getByRole('menuitem', { name: /Priority/ }));
    await settle();
    expect(screen.getByRole('menuitemradio', { name: /Low/ })).toBeTruthy();
    expect(screen.queryByRole('menuitemradio', { name: /Done/ })).toBeNull();
  });

  it('picks a choice and closes', async () => {
    const { onClose, onPick } = setup();
    await settle();
    fireEvent.click(screen.getByRole('menuitem', { name: /Status/ }));
    await settle();
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Done/ }));
    expect(onPick).toHaveBeenCalledWith('done');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on a click outside it', async () => {
    const { onClose } = setup();
    await settle();
    fireEvent.mouseDown(screen.getByText('outside'));
    expect(onClose).toHaveBeenCalled();
  });
});
