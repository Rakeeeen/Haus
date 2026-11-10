// @vitest-environment jsdom
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatePicker } from '@/ui/DatePicker';
import { FilterMulti, FilterSelect } from '@/ui/FilterSelect';

const STATUSES = [
  { value: 'active', label: 'In progress' }, { value: 'planning', label: 'Planning' }, { value: 'done', label: 'Done' },
] as const;

describe('FilterSelect', () => {
  function Demo() {
    const [v, setV] = useState<'active' | 'planning' | 'done'>('active');
    return <FilterSelect label="Show" options={STATUSES} value={v} onChange={setV} />;
  }
  it('names the choice, lists the others, and picks one', async () => {
    render(<Demo />);
    expect(screen.getByRole('button').textContent).toContain('In progress');
    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByRole('option', { name: /Done/ }));
    expect(screen.getByRole('button').textContent).toContain('Done');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
  it('closes on Escape', async () => {
    render(<Demo />);
    await userEvent.click(screen.getByRole('button'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });
  it('gets a search box only when the list is long', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ value: `p${i}`, label: i === 7 ? 'Needle' : `Project ${i}` }));
    render(<FilterSelect label="Project" options={many} value="p0" onChange={() => {}} />);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.type(screen.getByRole('textbox', { name: 'Find in the list' }), 'need');
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)).toEqual(['○ Needle']);
  });
});

describe('FilterMulti', () => {
  function Demo({ start = [] as string[] }) {
    const [vs, setVs] = useState(start);
    return <FilterMulti label="Show" options={STATUSES} values={vs} onChange={setVs} />;
  }
  it('says "All" when nothing is chosen, names one or two, counts more', async () => {
    const { unmount } = render(<Demo />);
    expect(screen.getByRole('button').textContent).toContain('All');
    unmount();
    render(<Demo start={['active', 'done']} />);
    expect(screen.getByRole('button').textContent).toContain('In progress, Done');
  });
  it('switches choices on and off without closing, and clears', async () => {
    render(<Demo />);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByRole('option', { name: /Planning/ }));
    await userEvent.click(screen.getByRole('option', { name: /Done/ }));
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(screen.getByRole('option', { name: /Planning/ }).getAttribute('aria-selected')).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getAllByRole('option').every((o) => o.getAttribute('aria-selected') === 'false')).toBe(true);
  });
});

describe('DatePicker', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-10T09:00:00')); });
  afterEach(() => vi.useRealTimers());

  function Demo({ start = null as string | null, allowClear = true }) {
    const [day, setDay] = useState(start);
    return <><DatePicker ariaLabel="Day" value={day} onChange={setDay} allowClear={allowClear} /><output data-testid="out">{day ?? 'none'}</output></>;
  }
  const open = () => userEvent.click(screen.getByRole('button', { name: 'Day' }));

  it('shows "No date" or the chosen day', () => {
    const { unmount } = render(<Demo />);
    expect(screen.getByRole('button', { name: 'Day' }).textContent).toContain('No date');
    unmount();
    render(<Demo start="2026-11-12" />);
    expect(screen.getByRole('button', { name: 'Day' }).textContent).toContain('Thu 12 Nov');
  });

  it('opens on the month of the chosen day, in the page\'s own layer (not inside the field)', async () => {
    render(<Demo start="2026-11-12" />);
    await open();
    expect(screen.getByText('November 2026')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Day' }).parentElement!.contains(screen.getByText('November 2026'))).toBe(false);
  });

  it('picks a day and stays open, so several can be tried', async () => {
    render(<Demo start="2026-11-12" />);
    await open();
    await userEvent.click(screen.getByRole('button', { name: '20' }));
    expect(screen.getByTestId('out').textContent).toBe('2026-11-20');
    expect(screen.getByText('November 2026')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '17' }));
    expect(screen.getByTestId('out').textContent).toBe('2026-11-17');
  });

  it('Today and Tomorrow follow the real date', async () => {
    render(<Demo />);
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByTestId('out').textContent).toBe('2026-11-10');
    await userEvent.click(screen.getByRole('button', { name: 'Tomorrow' }));
    expect(screen.getByTestId('out').textContent).toBe('2026-11-11');
  });

  it('moves between months', async () => {
    render(<Demo start="2026-11-12" />);
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('December 2026')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('October 2026')).toBeTruthy();
  });

  it('clears the day (unless it may not be cleared)', async () => {
    const { unmount } = render(<Demo start="2026-11-12" />);
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByTestId('out').textContent).toBe('none');
    unmount();
    render(<Demo start="2026-11-12" allowClear={false} />);
    await open();
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('closes on Escape, and on a click outside', async () => {
    render(<><Demo start="2026-11-12" /><button>elsewhere</button></>);
    await open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('November 2026')).toBeNull();
    await open();
    await userEvent.click(screen.getByText('elsewhere'));
    expect(screen.queryByText('November 2026')).toBeNull();
  });
});
