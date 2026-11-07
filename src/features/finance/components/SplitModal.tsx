import React, { useEffect, useState } from 'react';
import { AppModal } from '@/ui/AppModal';
import { useBodyScrollLock } from '@/ui/useBodyScrollLock';
import { formatEGP } from '@/domain/finance/money';
import {
  BUCKET_ORDER, assignmentError, incomeError, remainderOf, suggestAllocations, urgentDebtTotal,
  type Allocations, type Percentages,
} from '@/domain/finance/split';
import type { Debt, FinanceBanks, FinanceBuckets } from '@/domain/finance/types';
import { BANK_KEYS, BANK_LABELS, BUCKET_META } from '@/features/finance/components/visuals';
import { AmountInput, ChoiceGrid, Field, ModalForm, TextInput } from '@/features/finance/components/forms';

export type SplitResult =
  | { kind: 'income'; bank: keyof FinanceBanks; amount: number; allocations: Allocations; repayUrgent: boolean }
  | { kind: 'assign'; allocations: Allocations; direction: 1 | -1 };

type BucketTexts = Record<keyof FinanceBuckets, string>;

const toTexts = (a: Allocations): BucketTexts =>
  Object.fromEntries(BUCKET_ORDER.map((key) => [key, a[key] ? String(a[key]) : ''])) as BucketTexts;

const toAllocations = (texts: BucketTexts): Allocations => {
  const out: Allocations = {};
  for (const key of BUCKET_ORDER) {
    const value = parseFloat(texts[key]);
    if (value > 0) out[key] = value;
  }
  return out;
};

/**
 * Two jobs, one form. "Split income": an amount lands in a bank and is divided across the
 * buckets, starting from how the last one was split; what isn't given to a bucket simply stays
 * free. "Assign": move free money into buckets, or — when the buckets claim more than the banks
 * hold — say which buckets paid for what already left a bank.
 */
export const SplitModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  mode: 'income' | 'assign';
  buckets: FinanceBuckets;
  /** Banks total minus buckets total (used by `assign`). */
  free: number;
  template: Percentages;
  debts: Debt[];
  onConfirm: (result: SplitResult) => Promise<void>;
}> = ({ isOpen, onClose, mode, buckets, free, template, debts, onConfirm }) => {
  const [amount, setAmount] = useState('');
  const [bank, setBank] = useState<keyof FinanceBanks | null>(null);
  /** What's been typed in the bucket rows; null until the first edit, so they follow the suggestion. */
  const [typed, setTyped] = useState<BucketTexts | null>(null);
  const [repay, setRepay] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setAmount('');
    setBank(null);
    setTyped(null);
    setRepay(true);
  }, [isOpen, mode]);
  useBodyScrollLock(isOpen);

  const taking = mode === 'assign' && free < 0;
  /** The sum being divided: the income typed in, or the free money (or shortfall) being sorted. */
  const base = mode === 'income' ? parseFloat(amount) || 0 : Math.abs(free);
  const texts = typed ?? toTexts(mode === 'income' ? suggestAllocations(base, template) : {});
  const allocations = toAllocations(texts);
  const left = remainderOf(base, allocations);

  const urgentOwed = urgentDebtTotal(debts);
  const showRepay = mode === 'income' && (allocations.tawarr2 || 0) > 0 && urgentOwed > 0;

  const error = mode === 'income'
    ? (bank ? incomeError({ bank, amount: base, allocations }) : 'Pick a bank')
    : assignmentError(buckets, free, allocations);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result: SplitResult | null = mode === 'income'
      ? bank && { kind: 'income', bank, amount: base, allocations, repayUrgent: showRepay && repay }
      : { kind: 'assign', allocations, direction: taking ? -1 : 1 };
    if (!result || error || saving) return;
    setSaving(true);
    try {
      await onConfirm(result);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const title = mode === 'income' ? 'Split Income' : taking ? 'Take From Buckets' : 'Assign Money';
  const hint = mode === 'assign'
    ? taking
      ? `The buckets hold ${formatEGP(Math.abs(free))} more than the banks — pick the buckets that money came out of.`
      : `You have ${formatEGP(free)} free (in banks, in no bucket). Move some of it into buckets.`
    : undefined;
  const remainderLabel = left < 0 ? 'Over by' : taking ? 'Still to sort' : 'Stays free';

  return (
    <AppModal isOpen={isOpen} onClose={onClose} title={title} raw maxWidth="max-w-md">
      <ModalForm onSubmit={submit} scrollable disabled={!!error || saving} submitLabel={error ?? (mode === 'income' ? 'Split' : taking ? 'Take out' : 'Assign')}>
        {hint && <p className="font-mono-main text-[11px] leading-relaxed text-ink/60">{hint}</p>}

        {mode === 'income' && (
          <>
            <Field label="Amount received">
              <AmountInput value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus required />
            </Field>
            <Field label="Landed in">
              <ChoiceGrid
                options={BANK_KEYS.map((key) => ({ value: key, label: BANK_LABELS[key] }))}
                value={bank}
                onChange={setBank}
              />
            </Field>
          </>
        )}

        <Field label={taking ? 'Take from' : 'Split across'}>
          <div className="flex flex-col gap-2">
            {BUCKET_ORDER.map((key) => {
              const value = allocations[key] || 0;
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-sans-main text-[11px] font-bold uppercase tracking-wide">{BUCKET_META[key].en}</p>
                    <p className="font-mono-main text-[9px] text-ink/40">{formatEGP(buckets[key] || 0)}</p>
                  </div>
                  {base > 0 && value > 0 && (
                    <span className="font-mono-main text-[10px] w-10 text-right text-ink/40">{Math.round((value / base) * 100)}%</span>
                  )}
                  <TextInput
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={texts[key]}
                    onChange={(e) => setTyped({ ...texts, [key]: e.target.value })}
                    className="!w-28 !py-2 !text-[14px] text-right"
                  />
                </div>
              );
            })}
          </div>
        </Field>

        <p className={`font-mono-main text-[11px] flex justify-between ${left < 0 ? 'text-rust' : 'text-ink/60'}`}>
          <span>{remainderLabel}</span>
          <span className="font-bold">{formatEGP(Math.abs(left))}</span>
        </p>

        {showRepay && (
          <button
            type="button"
            onClick={() => setRepay((r) => !r)}
            className={`cursor-pointer text-left px-5 py-3 border rounded-full transition-colors font-mono-main text-[11px] ${repay ? 'bg-ink text-paper border-ink' : 'bg-transparent text-ink/40 border-ink/12 hover:bg-ink/5 hover:text-ink'}`}
          >
            {repay ? '✓ ' : ''}Also clear the Urgent debt ({formatEGP(Math.min(allocations.tawarr2 || 0, urgentOwed))} of {formatEGP(urgentOwed)})
          </button>
        )}
      </ModalForm>
    </AppModal>
  );
};
