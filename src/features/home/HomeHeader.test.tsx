// @vitest-environment jsdom
import type React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HomeHeader } from '@/features/home/HomeHeader';

const base: Omit<React.ComponentProps<typeof HomeHeader>, 'isOwner' | 'onAvatarClick'> = {
  greeting: { before: 'Hello ', name: 'Sara', after: '', achievement: null },
  greetingVisible: true, journalEntry: null, onNameClick: () => {}, photoUrl: 'https://example.com/me.jpg', initial: 'S', uploading: false,
  isDark: false, onToggleTheme: () => {}, onOpenGuests: () => {}, onLogout: () => {},
};

describe('the profile picture', () => {
  it('is pressed by Hamed to change it', async () => {
    const pick = vi.fn();
    render(<HomeHeader {...base} isOwner onAvatarClick={pick} />);
    await userEvent.click(screen.getByAltText('Avatar'));
    expect(pick).toHaveBeenCalled();
  });

  it('is the Google photo for a guest: nothing to press, and no camera to suggest changing it', async () => {
    const { container } = render(<HomeHeader {...base} isOwner={false} />);
    const picture = screen.getByAltText('Avatar').parentElement as HTMLElement;
    expect(picture.className).not.toContain('cursor-pointer');
    expect(container.querySelector('svg.lucide-camera, [data-icon="camera"]')).toBeNull();
    expect(picture.children.length).toBe(1); // the photo alone, without the hover overlay
  });
});
