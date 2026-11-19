import { describe, it, expect, vi } from 'vitest';
import { buildTaskMenu, type TaskMenuActions } from '@/features/work/taskMenu';
import { blankTask } from '@/domain/work/tasks';
import type { Task } from '@/domain/work/types';

const NOW = new Date(2026, 10, 19, 10, 0);
const task = (over: Partial<Task> = {}): Task => ({ ...blankTask(1, '2026-11-19', NOW), id: 't', title: 'Pay rent', ...over });
const actions = (over: Partial<TaskMenuActions> = {}): TaskMenuActions => ({
  canEdit: true, canDelete: true, setStatus: vi.fn(), setPriority: vi.fn(), setDate: vi.fn(), duplicate: vi.fn(), copyTitle: vi.fn(), remove: vi.fn(), ...over,
});
const find = (items: ReturnType<typeof buildTaskMenu>, label: string) => items.find((i) => i.kind !== 'separator' && i.label === label)!;

describe('buildTaskMenu', () => {
  it('offers finishing an open task and reopening a finished one', () => {
    expect(find(buildTaskMenu(task(), actions(), NOW), 'Mark done')).toBeTruthy();
    expect(find(buildTaskMenu(task({ status: 'done' }), actions(), NOW), 'Reopen')).toBeTruthy();
  });

  it('marks what the task already is', () => {
    const menu = buildTaskMenu(task({ status: 'doing', priority: 'high', date: '2026-11-20' }), actions(), NOW);
    const active = (label: string) => (find(menu, label) as Extract<typeof menu[number], { kind: 'submenu' }>).options.filter((o) => o.active).map((o) => o.label);
    expect(active('Status')).toEqual(['Doing']);
    expect(active('Priority')).toEqual(['High']);
    expect(active('Date')).toEqual(['Tomorrow']);
  });

  it('picks send the right values', () => {
    const a = actions();
    const menu = buildTaskMenu(task(), a, NOW);
    const choices = (label: string) => find(menu, label) as Extract<typeof menu[number], { kind: 'submenu' }>;
    choices('Priority').onPick('none');
    choices('Date').onPick('2026-11-26');
    choices('Status').onPick('doing');
    expect(a.setPriority).toHaveBeenCalledWith(null);
    expect(a.setDate).toHaveBeenCalledWith('2026-11-26');
    expect(a.setStatus).toHaveBeenCalledWith('doing');
    expect((choices('Date').options.find((o) => o.label === 'Today'))!.value).toBe('2026-11-19');
    expect((choices('Date').options.find((o) => o.label === 'Next week'))!.value).toBe('2026-11-26');
  });

  it("turns off what this person may not do, but still lets them copy the title and open it", () => {
    const menu = buildTaskMenu(task(), actions({ canEdit: false, canDelete: false, open: vi.fn() }), NOW);
    expect((find(menu, 'Mark done') as { disabled?: boolean }).disabled).toBe(true);
    expect((find(menu, 'Duplicate') as { disabled?: boolean }).disabled).toBe(true);
    expect((find(menu, 'Delete') as { disabled?: boolean }).disabled).toBe(true);
    expect((find(menu, 'Copy title') as { disabled?: boolean }).disabled).toBeFalsy();
    expect(find(menu, 'Open')).toBeTruthy();
  });
});
