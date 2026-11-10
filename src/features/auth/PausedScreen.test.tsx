// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PausedScreen } from '@/features/auth/PausedScreen';

describe('PausedScreen', () => {
  it('tells guests Haus is resting, with Hamed\'s own words when he left some', () => {
    render(<PausedScreen message="Back at 9, adding something new" onSignOut={() => {}} />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('Back at 9, adding something new')).toBeTruthy();
  });
  it('says something kind when there is no message, and still lets a guest sign out', async () => {
    const out = vi.fn();
    render(<PausedScreen onSignOut={out} />);
    expect(screen.getByText(/Nothing is lost/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(out).toHaveBeenCalled();
  });
});
