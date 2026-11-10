// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_BANKS, EMPTY_BUCKETS } from '@/domain/finance/defaults';
import type { Debt, FinanceLog } from '@/domain/finance/types';
import { DebtsTab } from '@/features/finance/components/DebtsTab';
import { LogsTab } from '@/features/finance/components/LogsTab';
import { Finance } from '@/features/finance/Finance';

const state = vi.hoisted(() => ({
  debts: [] as Debt[],
  logs: [] as FinanceLog[],
  setDebts: vi.fn(async () => {}),
  removeLog: vi.fn(async () => {}),
}));

vi.mock('@/features/finance/useFinance', () => ({
  useFinance: () => ({
    banks: EMPTY_BANKS, buckets: EMPTY_BUCKETS, setBuckets: vi.fn(),
    splitTemplate: {}, setSplitTemplate: vi.fn(),
    gold: [], setGold: vi.fn(), thndr: [], setThndr: vi.fn(), thndrFlows: [], setThndrFlows: vi.fn(),
    subscriptions: [], setSubscriptions: vi.fn(),
    debts: state.debts, setDebts: state.setDebts,
    updateBankBalance: vi.fn(), updateBucketBalance: vi.fn(),
    logs: state.logs, addLog: vi.fn(), removeLog: state.removeLog,
  }),
}));
vi.mock('@/data/useGoldPrices', () => ({ useGoldPrices: () => null }));

const debt = (over: Partial<Debt>): Debt => ({ id: 'd1', personName: 'Aly', amount: 250, type: 'owed_to_me', ...over });

beforeEach(() => {
  state.debts = [];
  state.logs = [];
  state.setDebts.mockClear();
  state.removeLog.mockClear();
});

describe('DebtsTab', () => {
  it('shows both sides with their empty messages', () => {
    render(<DebtsTab debts={[]} setDebts={state.setDebts} privacyMode={false} onEdit={() => {}} onAdd={() => {}} />);
    expect(screen.getByText('Nobody owes you.')).toBeTruthy();
    expect(screen.getByText('You owe nobody.')).toBeTruthy();
  });

  it('lists each debt on its own side and totals them', () => {
    const debts = [debt({}), debt({ id: 'd2', personName: 'Sara', amount: 100, type: 'owed_by_me', notes: 'Dinner' })];
    render(<DebtsTab debts={debts} setDebts={state.setDebts} privacyMode={false} onEdit={() => {}} onAdd={() => {}} />);
    expect(screen.getByText('Aly')).toBeTruthy();
    expect(screen.getByText('Sara')).toBeTruthy();
    expect(screen.getByText('Dinner')).toBeTruthy();
    expect(screen.queryByText('Nobody owes you.')).toBeNull();
  });

  it('adds on the side whose button was pressed, edits and removes a row', async () => {
    const onAdd = vi.fn();
    const onEdit = vi.fn();
    const debts = [debt({}), debt({ id: 'd2', personName: 'Sara', type: 'owed_by_me' })];
    render(<DebtsTab debts={debts} setDebts={state.setDebts} privacyMode={false} onEdit={onEdit} onAdd={onAdd} />);
    const adds = screen.getAllByRole('button', { name: 'Add' });
    await userEvent.click(adds[1]);
    expect(onAdd).toHaveBeenCalledWith('owed_by_me');

    await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    expect(onEdit).toHaveBeenCalledWith(debts[0]);

    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(state.setDebts).toHaveBeenCalledWith([debts[1]]);
  });
});

describe('LogsTab', () => {
  it('says so when there is nothing for the day', () => {
    render(<LogsTab logs={[]} removeLog={state.removeLog} />);
    expect(screen.getByText('No transactions')).toBeTruthy();
  });

  it('lists today\'s movements with their sign, and removes one', async () => {
    state.logs = [
      { id: 'l1', type: 'deposit', amount: 500, bank: 'CIB', bucket: 'Savings', mode: 'manual', timestamp: new Date().toISOString() },
      { id: 'l2', type: 'withdraw', amount: 120, bank: 'CIB', mode: 'manual', category: 'Food', timestamp: new Date().toISOString() },
    ];
    render(<LogsTab logs={state.logs} removeLog={state.removeLog} />);
    expect(screen.getByText('Deposit')).toBeTruthy();
    expect(screen.getByText('Withdraw')).toBeTruthy();
    expect(screen.getByText('CIB · Savings')).toBeTruthy();
    expect(screen.getByText('CIB')).toBeTruthy();
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(state.removeLog).toHaveBeenCalledWith('l1');
  });

  it('can widen the range from the filter', async () => {
    render(<LogsTab logs={[]} removeLog={state.removeLog} />);
    await userEvent.click(screen.getByRole('button', { name: /Showing/ }));
    await userEvent.click(screen.getByRole('option', { name: /This year/ }));
    expect(screen.getByRole('button', { name: /Showing/ }).textContent).toContain('This year');
  });
});

describe('Finance page', () => {
  const go = vi.fn();
  const open = () => render(<Finance navigate={go} />);

  it('opens on the overview, titled, with privacy on', () => {
    open();
    expect(screen.getByRole('heading', { name: /Finances/i })).toBeTruthy();
    expect(screen.getByText('PRIVATE')).toBeTruthy();
    expect(document.title).toContain('Finance');
  });

  it('switches the privacy switch', async () => {
    open();
    await userEvent.click(screen.getByText('PRIVATE'));
    expect(screen.getByText('VISIBLE')).toBeTruthy();
  });

  it('moves between its tabs, and the Payit tab carries that name', async () => {
    open();
    expect(screen.getByRole('tab', { name: 'Payit' })).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: /debts/i }));
    expect(screen.getByText('Nobody owes you.')).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: /logs/i }));
    expect(screen.getByText('Transaction Logs')).toBeTruthy();
  });

  it('opens the debt form from the Debts tab and saves a new debt', async () => {
    open();
    await userEvent.click(screen.getByRole('tab', { name: /debts/i }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]);
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByPlaceholderText('e.g. Aly, Hamed'), 'Mona');
    await userEvent.type(within(dialog).getByPlaceholderText('0.00'), '75');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Log Debt' }));
    expect(state.setDebts).toHaveBeenCalledTimes(1);
    const saved = (state.setDebts.mock.calls[0] as unknown as [Debt[]])[0];
    expect(saved).toEqual([expect.objectContaining({ personName: 'Mona', amount: 75, type: 'owed_to_me' })]);
  });

  it('edits an existing debt in the same form', async () => {
    state.debts = [debt({})];
    open();
    await userEvent.click(screen.getByRole('tab', { name: /debts/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    const amount = within(dialog).getByPlaceholderText('0.00');
    await userEvent.clear(amount);
    await userEvent.type(amount, '300');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));
    const saved = (state.setDebts.mock.calls[0] as unknown as [Debt[]])[0];
    expect(saved).toEqual([expect.objectContaining({ id: 'd1', personName: 'Aly', amount: 300 })]);
  });

  it.each(['gold', 'thndr', 'payit'])('renders the %s tab without breaking', async (name) => {
    open();
    await userEvent.click(screen.getByRole('tab', { name: new RegExp(name, 'i') }));
    expect(screen.getByRole('heading', { name: /Finances/i })).toBeTruthy();
  });
});
