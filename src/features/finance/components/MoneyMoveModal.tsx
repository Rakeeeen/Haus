import React, { useEffect, useState } from 'react';
import { AppModal } from '@/ui/AppModal';
import { useBodyScrollLock } from '@/ui/useBodyScrollLock';
import { evalAmount, formatEGP } from '@/domain/finance/money';
import { moveError, type MoneyMove } from '@/domain/finance/moves';
import { BUCKET_ORDER, matchMove } from '@/domain/finance/split';
import type { FinanceBanks, FinanceBuckets } from '@/domain/finance/types';
import { BANK_KEYS, BANK_LABELS, BUCKET_META } from '@/features/finance/components/visuals';
import { AmountInput, ChoiceGrid, Field, ModalForm, Segmented, type Choice } from '@/features/finance/components/forms';

export interface MoveDraft {
  type: 'deposit' | 'withdraw' | 'match';
  bank: keyof FinanceBanks | null;
}

type BucketChoice = keyof FinanceBuckets | 'none';

const TYPE_OPTIONS = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdraw', label: 'Withdraw' },
  { value: 'match', label: 'Match' },
] as const;

const TITLES: Record<MoveDraft['type'], string> = { deposit: 'Add Deposit', withdraw: 'Withdraw', match: 'Match Bank Balance' };

/**
 * One modal for moving money in a bank: deposit or withdraw an amount (optionally tagged to a
 * bucket), or "match" — type what the bank itself says you hold and the difference is booked
 * for you, untagged, so a forgotten withdrawal still gets caught. Opened from the hero buttons,
 * or from a bank row with that bank already chosen.
 */
export const MoneyMoveModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  initial: MoveDraft;
  banks: FinanceBanks;
  buckets: FinanceBuckets;
  onConfirm: (move: MoneyMove) => Promise<void>;
}> = ({ isOpen, onClose, initial, banks, buckets, onConfirm }) => {
  const [type, setType] = useState<MoveDraft['type']>(initial.type);
  const [amount, setAmount] = useState('');
  const [bank, setBank] = useState<keyof FinanceBanks | null>(initial.bank);
  const [bucket, setBucket] = useState<BucketChoice>('none');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setType(initial.type);
    setBank(initial.bank);
    setAmount('');
    setBucket('none');
  }, [isOpen, initial]);
  useBodyScrollLock(isOpen);

  const matching = type === 'match';
  const value = evalAmount(amount);

  // What confirming would do, and why it can't yet.
  let move: MoneyMove | null = null;
  let error: string | null = 'Pick a bank';
  if (bank && matching) {
    move = Number.isFinite(value) ? matchMove(banks, bank, value) : null;
    error = move ? null : amount === '' ? 'Enter the balance' : 'Already matches';
  } else if (bank) {
    move = { type: type as 'deposit' | 'withdraw', amount: value, bank, bucket: bucket === 'none' ? null : bucket };
    error = moveError(move, banks, buckets);
  }

  const bankOptions: Choice<keyof FinanceBanks>[] = BANK_KEYS.map((key) => ({
    value: key, label: BANK_LABELS[key], sub: formatEGP(banks[key] || 0),
  }));
  const bucketOptions: Choice<BucketChoice>[] = [
    { value: 'none', label: 'No bucket' },
    ...BUCKET_ORDER.map((key) => ({ value: key, label: BUCKET_META[key].en, sub: formatEGP(buckets[key] || 0) })),
  ];

  const submitLabel = error
    ?? (matching && move ? `Book ${move.type === 'deposit' ? '+' : '−'}${formatEGP(move.amount)}` : type === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdrawal');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!move || error || saving) return;
    setSaving(true);
    try {
      await onConfirm(move);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal isOpen={isOpen} onClose={onClose} title={TITLES[type]} raw maxWidth="max-w-sm">
      <ModalForm onSubmit={submit} tone={type === 'withdraw' ? 'danger' : 'primary'} disabled={!!error || saving} submitLabel={submitLabel}>
        <Segmented options={TYPE_OPTIONS} value={type} onChange={setType} />
        <Field
          label={matching ? 'Balance the bank shows' : 'Amount'}
          hint={matching ? 'The difference is booked untagged — sort it out later with Assign.' : undefined}
        >
          <AmountInput value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
        </Field>
        <Field label="Bank account">
          <ChoiceGrid options={bankOptions} value={bank} onChange={setBank} />
        </Field>
        {!matching && (
          <Field
            label="Bucket"
            optional
            hint={type === 'withdraw' && bucket === 'tawarr2' ? "Taking from Tawarru' is logged as a debt you owe yourself." : undefined}
          >
            <ChoiceGrid options={bucketOptions} value={bucket} onChange={setBucket} />
          </Field>
        )}
      </ModalForm>
    </AppModal>
  );
};
