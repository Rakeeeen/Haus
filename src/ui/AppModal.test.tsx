// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppModal } from '@/ui/AppModal';

describe('AppModal', () => {
  it('shows nothing while closed', () => {
    render(<AppModal isOpen={false} onClose={() => {}} title="Hello">body</AppModal>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a dialog named by its title, and takes focus', () => {
    render(<AppModal isOpen onClose={() => {}} title="Guests">body</AppModal>);
    const dialog = screen.getByRole('dialog', { name: 'Guests' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(dialog);
  });

  it('closes on Escape, on its button, and on a click outside the card — but not on a click inside it', () => {
    const onClose = vi.fn();
    render(<AppModal isOpen onClose={onClose} title="T"><p>inside</p></AppModal>);
    fireEvent.click(screen.getByText('inside'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'ESC' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('keeps the page behind from scrolling while open, and lets it again after', () => {
    const { rerender } = render(<AppModal isOpen onClose={() => {}} title="T">x</AppModal>);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<AppModal isOpen={false} onClose={() => {}} title="T">x</AppModal>);
    expect(document.body.style.overflow).toBe('');
  });

  it('gives focus back to what had it before it opened', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { rerender } = render(<AppModal isOpen onClose={() => {}} title="T">x</AppModal>);
    expect(document.activeElement).not.toBe(opener);
    rerender(<AppModal isOpen={false} onClose={() => {}} title="T">x</AppModal>);
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('as a confirmation: runs the action, then closes', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<AppModal isOpen onClose={onClose} title="Sure?" confirm={{ message: 'Really?', confirmText: 'Do it', onConfirm }} />);
    expect(screen.getByText('Really?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Do it' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
