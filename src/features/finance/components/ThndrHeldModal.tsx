import React, { useEffect, useState } from 'react';
import { AppModal } from '@/ui/AppModal';
import { formatEGP, evalAmount } from '@/domain/finance/money';
import { AmountInput, Field, ModalForm, Segmented } from '@/features/finance/components/forms';

type Mode = 'add' | 'take';

const OPTIONS = [
  { value: 'add', label: 'Add' },
  { value: 'take', label: 'Take out' },
] as const;

/** What Thndr holds after the change; null when the amount can't be used. */
export const thndrAfter = (mode: Mode, current: number, typed: number): number | null => {
  if (!Number.isFinite(typed) || typed < 0) return null;
  if (typed === 0) return null;
  const next = mode === 'add' ? current + typed : current - typed;
  return next < 0 ? null : next;
};

/**
 * Thndr's share of the Future fund, kept like a bucket: add to it or take from it. The amount can be a sum ("1500+250").
 */
export const ThndrHeldModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  current: number;
  onConfirm: (value: number) => Promise<void> | void;
}> = ({ isOpen, onClose, current, onConfirm }) => {
  const [mode, setMode] = useState<Mode>('add');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setMode('add');
    setAmount('');
  }, [isOpen]);

  const next = thndrAfter(mode, current, evalAmount(amount));
  const error = amount === '' ? 'Enter the amount' : next === null ? 'Check the amount' : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next === null || saving) return;
    setSaving(true);
    try {
      await onConfirm(next);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal isOpen={isOpen} onClose={onClose} title="Thndr" raw maxWidth="max-w-sm">
      <ModalForm
        onSubmit={submit}
        tone={mode === 'take' ? 'danger' : 'primary'}
        disabled={!!error || saving}
        submitLabel={error ?? `Thndr becomes ${formatEGP(next!)}`}
      >
        <Segmented options={OPTIONS} value={mode} onChange={setMode} />
        <Field label="Amount" hint={`Now ${formatEGP(current)} — part of the Future fund.`}>
          <AmountInput value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
        </Field>
      </ModalForm>
    </AppModal>
  );
};
