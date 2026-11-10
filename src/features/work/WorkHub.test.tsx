// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeProject, normalizeTask } from '@/domain/work/sharing';
import type { Task } from '@/domain/work/types';

const today = new Date().toISOString().slice(0, 10); // dayKey uses local time; the day filter below is "All", so this only dates the rows
const projects = [
  normalizeProject({ id: 'p1', name: 'Haus', status: 'active' }),
  normalizeProject({ id: 'p2', name: 'Gaza', status: 'done' }),
];
const tasks: Task[] = [
  normalizeTask({ id: 't1', no: 1, title: 'Write the report', projectIds: ['p1'], date: today }),
  normalizeTask({ id: 't2', no: 2, title: 'Her task', assigneeUids: ['g1'], assignee: 'Basmalla', date: today }),
  normalizeTask({ id: 't3', no: 3, title: 'Done thing', status: 'done', projectIds: ['p2'] }),
];

const work = {
  role: 'owner', guestUid: null, me: 'owner', ready: true, projects, tasks, notes: [], privates: {},
  canEditTask: () => true, toggleTaskDone: vi.fn(), setTaskStatus: vi.fn(), updateTask: vi.fn(), addTask: vi.fn(), removeTask: vi.fn(),
  addProject: vi.fn(), updateProject: vi.fn(), setSharing: vi.fn(), setClient: vi.fn(), removeProject: vi.fn(),
};
vi.mock('@/data/useWork', () => ({ useWork: () => work, useWorkOptional: () => work, useComments: () => ({ comments: [], add: vi.fn(), remove: vi.fn() }) }));
vi.mock('@/data/useMembers', () => ({ useGuests: () => ({ guests: [], error: '', invite: vi.fn(), setActive: vi.fn(), remove: vi.fn() }) }));

import { WorkHub } from '@/features/work/WorkHub';

const titles = () => screen.queryAllByText(/Write the report|Her task|Done thing/).map((e) => e.textContent);
const renderHub = () => render(<WorkHub navigate={vi.fn()} author="Hamed" />);

beforeEach(() => { localStorage.clear(); work.toggleTaskDone.mockClear(); });

describe('the Tasks home', () => {
  it('lists the tasks and the projects, with the way into each page', () => {
    renderHub();
    expect(titles()).toEqual(['Write the report', 'Done thing']); // "Mine": the one for Basmalla is not shown
    expect(screen.getByRole('button', { name: /Projects/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /All tasks/ })).toBeTruthy();
    expect(screen.getAllByText('Haus').length).toBeGreaterThan(0);
  });

  it('shows only my tasks by default, and everyone\'s when asked (and remembers it)', async () => {
    renderHub();
    expect(titles()).not.toContain('Her task');
    await userEvent.click(screen.getByRole('button', { name: /Whose/ }));
    await userEvent.click(screen.getByRole('option', { name: /Everyone/ }));
    expect(titles()).toContain('Her task');
    expect(localStorage.getItem('work_whose')).toBe('"all"');
  });

  it('puts the project on the task as a tag', () => {
    renderHub();
    const row = screen.getByText('Write the report').closest('div.flex.items-center')!;
    expect(within(row as HTMLElement).getByText('Haus')).toBeTruthy();
  });

  it('hides the "To do" tag (the usual state) but shows others', () => {
    renderHub();
    const mine = screen.getByText('Write the report').closest('div.flex.items-center') as HTMLElement;
    expect(within(mine).queryByText('To do')).toBeNull();
    const done = screen.getByText('Done thing').closest('div.flex.items-center') as HTMLElement;
    expect(within(done).getByText('Done')).toBeTruthy();
  });

  it('the tick finishes a task', async () => {
    renderHub();
    await userEvent.click(screen.getAllByRole('button', { name: 'Mark as done' })[0]);
    expect(work.toggleTaskDone).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }));
  });

  it('New task opens the editor for a new task', async () => {
    renderHub();
    await userEvent.click(screen.getByRole('button', { name: /New task/ }));
    expect(screen.getByRole('dialog', { name: 'New task' })).toBeTruthy();
  });

  it('the editor keeps what was typed when closed by accident, and offers it again', async () => {
    renderHub();
    await userEvent.click(screen.getByRole('button', { name: /New task/ }));
    await userEvent.type(screen.getByPlaceholderText('What needs doing?'), 'Call the client');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); // after its exit animation
    await userEvent.click(screen.getByRole('button', { name: /New task/ }));
    expect((screen.getByPlaceholderText('What needs doing?') as HTMLInputElement).value).toBe('Call the client');
    expect(screen.getByText('Picked up where you left off.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect((screen.getByPlaceholderText('What needs doing?') as HTMLInputElement).value).toBe('');
  });

  it('filters by status', async () => {
    renderHub();
    await userEvent.click(screen.getAllByRole('button', { name: /Status/ })[0]); // the tasks card's (the projects card's comes after it)
    await userEvent.click(screen.getByRole('option', { name: /Done/ }));
    expect(titles()).toEqual(['Done thing']);
  });
});
