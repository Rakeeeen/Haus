import React, { useEffect, useState } from 'react';
import { AppModal } from '@/ui/AppModal';
import { formatEGP } from '@/domain/finance/money';
import { removeById } from '@/domain/finance/collections';
import { debtTotals } from '@/domain/finance/insights';
import type { Debt } from '@/domain/finance/types';
import { MaskedValue } from '@/features/finance/components/visuals';
import { Field, ModalForm, Segmented, TextInput } from '@/features/finance/components/forms';
import { EmptyState, InlineActions, ListCard, ListRow } from '@/features/finance/components/lists';
import { ActionButton } from '@/features/finance/components/ActionButton';
import { captionLabel } from '@/features/finance/components/labels';

/** Add and edit share one form: pass `initial` to edit. Opened from Finance, whose tab row holds the Add button. */
export const DebtModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  initial: Debt | null;
  /** The side a new debt starts on — the column whose Add was pressed. */
  defaultType: Debt['type'];
  onSave: (debt: Debt) => void;
}> = ({ isOpen, onClose, initial, defaultType, onSave }) => {
  const [type, setType] = useState<Debt['type']>('owed_to_me');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setType(initial?.type ?? defaultType);
    setName(initial?.personName ?? '');
    setAmount(initial ? String(initial.amount) : '');
    setNotes(initial?.notes ?? '');
  }, [isOpen, initial, defaultType]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amount) return;
    onSave({
      id: initial?.id ?? `${Date.now()}`,
      personName: name.trim(),
      amount: parseFloat(amount),
      type,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <AppModal isOpen={isOpen} onClose={onClose} title={initial ? 'Edit Debt' : 'Log Debt'} raw maxWidth="max-w-sm">
      <ModalForm onSubmit={submit} submitLabel={initial ? 'Save Changes' : 'Log Debt'}>
        <Field label="Type">
          <Segmented options={[{ value: 'owed_to_me', label: 'Owed to Me' }, { value: 'owed_by_me', label: 'I Owe Them' }]} value={type} onChange={setType} />
        </Field>
        <Field label="Name">
          <TextInput type="text" placeholder="e.g. Aly, Hamed" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </Field>
        <Field label="Amount — EGP">
          <TextInput look="amount" type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label="Notes" optional>
          <TextInput type="text" placeholder="e.g. Dinner cash back" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </ModalForm>
    </AppModal>
  );
};

export const DebtsTab: React.FC<{
  debts: Debt[];
  setDebts: (next: Debt[]) => Promise<void>;
  privacyMode: boolean;
  onEdit: (debt: Debt) => void;
  onAdd: (type: Debt['type']) => void;
}> = ({ debts, setDebts, privacyMode, onEdit, onAdd }) => {
  const totals = debtTotals(debts);
  const receivable = debts.filter((d) => d.type === 'owed_to_me');
  const payable = debts.filter((d) => d.type === 'owed_by_me');

  const column = (type: Debt['type'], title: string, total: number, list: Debt[], empty: string) => (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className={captionLabel}>{title}</p>
        <div className="flex items-center gap-5">
          <MaskedValue disabled={!privacyMode} className="font-mono-main text-sm font-black" align="end">{formatEGP(total)}</MaskedValue>
          <ActionButton onClick={() => onAdd(type)}>Add</ActionButton>
        </div>
      </div>
      {list.length === 0 ? <EmptyState>{empty}</EmptyState> : (
        <ListCard>
          {list.map((debt, i) => (
            <ListRow key={debt.id} first={i === 0}>
              <div className="flex-1 min-w-0">
                <p className="font-sans-main font-black text-base truncate">{debt.personName}</p>
                {debt.notes && <p className="font-mono-main italic text-[11px] mt-1 text-ink/40">{debt.notes}</p>}
              </div>
              <p className="font-mono-main font-black text-xl">{formatEGP(debt.amount)}</p>
              <InlineActions onEdit={() => onEdit(debt)} onRemove={() => setDebts(removeById(debts, debt.id))} />
            </ListRow>
          ))}
        </ListCard>
      )}
    </section>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
      {column('owed_to_me', 'Owed to me', totals.owedToMe, receivable, 'Nobody owes you.')}
      {column('owed_by_me', 'I owe', totals.owedByMe, payable, 'You owe nobody.')}
    </div>
  );
};
