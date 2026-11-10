// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PageHeader } from '@/ui/PageHeader';

describe('PageHeader', () => {
  it('shows the way back and the title; the last crumb is the page you are on', async () => {
    const navigate = vi.fn();
    render(<PageHeader navigate={navigate} title="Water" crumbs={[{ label: 'Home', to: 'home' }, { label: 'Water' }]} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Water');
    expect(screen.getByText('Water', { selector: 'span' }).getAttribute('aria-current')).toBe('page');
    await userEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(navigate).toHaveBeenCalledWith('home');
  });

  it('puts things beside the breadcrumb and beside the title', () => {
    render(<PageHeader navigate={() => {}} title="T" crumbs={[{ label: 'Home', to: 'home' }]} trailing={<i>privacy</i>} aside={<i>tabs</i>} />);
    expect(screen.getByText('privacy')).toBeTruthy();
    expect(screen.getByText('tabs')).toBeTruthy();
  });

  it('writes an Arabic title as it is — no capitals, no letter-spacing — on a taller line', () => {
    render(<PageHeader navigate={() => {}} title="غزل" crumbs={[{ label: 'Home' }]} />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.className).not.toContain('uppercase');
    expect(h1.className).not.toContain('tracking-tight');
    expect(h1.className).toContain('leading-[1.25]');
  });

  it('a Latin title is in capitals', () => {
    render(<PageHeader navigate={() => {}} title="Tasks" crumbs={[{ label: 'Home' }]} />);
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('uppercase');
  });
});
