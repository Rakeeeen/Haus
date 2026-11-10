// @vitest-environment jsdom
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ChooseRow, SelectMenu, SelectMulti, type MenuOption } from '@/ui/Form';

const PROJECTS: MenuOption[] = [
  { value: '', label: 'No project' },
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'g', label: 'Gamma' },
  { value: 'ar', label: 'غزل' },
];

function Single({ start = '' }: { start?: string }) {
  const [value, setValue] = useState(start);
  return <><SelectMenu ariaLabel="Project" options={PROJECTS} value={value} onChange={setValue} /><output data-testid="out">{value}</output></>;
}
function Multi({ start = [] as string[] }) {
  const [values, setValues] = useState(start);
  return <><SelectMulti ariaLabel="Projects" options={PROJECTS.slice(1)} values={values} onChange={setValues} empty="None yet" /><output data-testid="out">{values.join(',')}</output></>;
}
const list = () => screen.queryByRole('listbox');

describe('SelectMenu', () => {
  it('names what is chosen, and opens a list on a click', async () => {
    render(<Single start="b" />);
    expect(screen.getByRole('button', { name: 'Project' }).textContent).toContain('Beta');
    await userEvent.click(screen.getByRole('button', { name: 'Project' }));
    expect(within(list()!).getAllByRole('option')).toHaveLength(5);
  });

  it('picks an option and closes', async () => {
    render(<Single />);
    await userEvent.click(screen.getByRole('button', { name: 'Project' }));
    await userEvent.click(screen.getByRole('option', { name: 'Gamma' }));
    expect(screen.getByTestId('out').textContent).toBe('g');
    expect(list()).toBeNull();
  });

  it('narrows the list as you type in the field itself (Arabic too), and says when nothing matches', async () => {
    render(<Single />);
    await userEvent.click(screen.getByRole('button', { name: 'Project' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Project' }), 'ta');
    expect(within(list()!).getAllByRole('option').map((o) => o.textContent)).toEqual(['Beta']);
    await userEvent.clear(screen.getByRole('textbox', { name: 'Project' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Project' }), 'غز');
    expect(within(list()!).getAllByRole('option').map((o) => o.textContent)).toEqual(['غزل']);
    await userEvent.clear(screen.getByRole('textbox', { name: 'Project' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Project' }), 'zzz');
    expect(screen.getByText('Nothing matches.')).toBeTruthy();
  });

  it('Enter picks the first match', async () => {
    render(<Single />);
    await userEvent.click(screen.getByRole('button', { name: 'Project' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Project' }), 'gam{Enter}');
    expect(screen.getByTestId('out').textContent).toBe('g');
  });

  it('closes on Escape and on a click outside, keeping the choice', async () => {
    render(<><Single start="a" /><button>elsewhere</button></>);
    await userEvent.click(screen.getByRole('button', { name: 'Project' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(list()).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Project' }));
    await userEvent.click(screen.getByText('elsewhere'));
    expect(list()).toBeNull();
    expect(screen.getByTestId('out').textContent).toBe('a');
  });

  it('does not open when disabled', async () => {
    render(<SelectMenu ariaLabel="Project" options={PROJECTS} value="" onChange={() => {}} disabled />);
    await userEvent.click(screen.getByRole('button', { name: 'Project' }));
    expect(list()).toBeNull();
  });

  it('keeps the field one height whether it is closed or open (no jump when you start typing)', async () => {
    const { container } = render(<Single />);
    expect(container.querySelector('button')!.className).toContain('h-[52px]');
    await userEvent.click(screen.getByRole('button', { name: 'Project' }));
    expect(screen.getByRole('textbox', { name: 'Project' }).parentElement!.className).toContain('h-[52px]');
  });
});

describe('SelectMulti', () => {
  it('shows what it holds when nothing is chosen', () => {
    render(<Multi />);
    expect(screen.getByRole('button', { name: 'Projects' }).textContent).toContain('None yet');
  });

  it('ticks several, and the list stays open while it does', async () => {
    render(<Multi />);
    await userEvent.click(screen.getByRole('button', { name: 'Projects' }));
    await userEvent.click(screen.getByRole('option', { name: /Alpha/ }));
    await userEvent.click(screen.getByRole('option', { name: /Gamma/ }));
    expect(list()).not.toBeNull();
    expect(screen.getByTestId('out').textContent).toBe('a,g');
    expect(screen.getByRole('option', { name: /Alpha/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('unticks, and clears them all', async () => {
    render(<Multi start={['a', 'b']} />);
    await userEvent.click(screen.getByRole('button', { name: 'Projects' }));
    await userEvent.click(screen.getByRole('option', { name: /Alpha/ }));
    expect(screen.getByTestId('out').textContent).toBe('b');
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByTestId('out').textContent).toBe('');
  });

  it('names the chosen ones in the field', () => {
    render(<Multi start={['a', 'g']} />);
    expect(screen.getByRole('button', { name: 'Projects' }).textContent).toContain('Alpha, Gamma');
  });
});

describe('ChooseRow', () => {
  it('marks the chosen one and reports a new choice', async () => {
    const seen: string[] = [];
    function Row() {
      const [v, setV] = useState('todo');
      return <ChooseRow options={[{ value: 'todo', label: 'To do' }, { value: 'done', label: 'Done' }]} value={v} onChange={(n) => { seen.push(n); setV(n); }} />;
    }
    render(<Row />);
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(seen).toEqual(['done']);
    expect(screen.getByRole('button', { name: 'Done' }).className).toContain('btn-ink');
    expect(screen.getByRole('button', { name: 'To do' }).className).toContain('btn-outline');
  });
});
