'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import AsicFormField from '@/components/asic/AsicFormField';
import { asicFormGrid, asicInput, asicTextarea } from '@/components/asic/ui';
import { btnPrimary, btnSecondary } from '@/lib/ui';
import {
  icFormSectionEyebrow,
  icFormSectionDivider,
  icPurchaseDenseInput,
} from '@/components/ic-transfer/shared/icTransferFormModalLayout';
import FormattedNumberInput from '@/components/ic-transfer/shared/FormattedNumberInput';
import CapitalBookToggle from '@/components/capital/CapitalBookToggle';
import type { CapitalDashboard } from '@/lib/capital/position';

export type CapitalModalKind =
  | 'investor'
  | 'opening'
  | 'management'
  | 'deposit'
  | 'withdraw'
  | 'payout';

export type CapitalDashData = CapitalDashboard & {
  settings: {
    openingAed: number;
    openingInr: number;
    openingInrPerAed: number;
    managementInvestorId: string | null;
  };
};

const denseInput = `${asicInput} ${icPurchaseDenseInput}`;

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <h3 className={`${icFormSectionEyebrow} ${icFormSectionDivider} sm:col-span-2 lg:col-span-12`}>{children}</h3>
  );
}

const MODAL_COPY: Record<
  CapitalModalKind,
  { title: string; submit: string; maxWidth?: string }
> = {
  investor: { title: 'Add investor', submit: 'Create investor', maxWidth: 'max-w-lg w-[96vw]' },
  opening: { title: 'Opening capital', submit: 'Save opening', maxWidth: 'max-w-2xl w-[96vw]' },
  management: { title: 'Management share', submit: 'Save settings', maxWidth: 'max-w-lg w-[96vw]' },
  deposit: { title: 'Record deposit', submit: 'Post deposit', maxWidth: 'max-w-2xl w-[96vw]' },
  withdraw: { title: 'Record withdrawal', submit: 'Post withdrawal', maxWidth: 'max-w-2xl w-[96vw]' },
  payout: { title: 'Profit payout', submit: 'Post payout', maxWidth: 'max-w-2xl w-[96vw]' },
};

type Props = {
  open: boolean;
  kind: CapitalModalKind;
  data: CapitalDashData;
  banksAed: Array<{ id: string; name: string }>;
  banksInr: Array<{ id: string; name: string }>;
  defaultDate: string;
  saving: boolean;
  disabled?: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
};

export default function CapitalModal({
  open,
  kind,
  data,
  banksAed,
  banksInr,
  defaultDate,
  saving,
  disabled,
  onClose,
  onSubmit,
}: Props) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [openingAed, setOpeningAed] = useState(data.settings.openingAed);
  const [openingInr, setOpeningInr] = useState(data.settings.openingInr);
  const [inrPerAed, setInrPerAed] = useState(data.settings.openingInrPerAed);
  const [mgmtPct, setMgmtPct] = useState(data.managementSharePct);
  const [mgmtInvestor, setMgmtInvestor] = useState(data.settings.managementInvestorId ?? '');
  const [book, setBook] = useState<'AED' | 'INR'>('AED');
  const [investorId, setInvestorId] = useState(
    data.investors.find(i => !i.isHouse)?.id ?? data.investors[0]?.id ?? '',
  );
  const [bankId, setBankId] = useState('');
  const [amount, setAmount] = useState(0);
  const [lotDate, setLotDate] = useState(defaultDate);
  const [voucherDate, setVoucherDate] = useState(defaultDate);

  const banks = book === 'INR' ? banksInr : banksAed;
  const copy = MODAL_COPY[kind];

  useEffect(() => {
    if (!open) return;
    setName('');
    setNotes('');
    setOpeningAed(data.settings.openingAed);
    setOpeningInr(data.settings.openingInr);
    setInrPerAed(data.settings.openingInrPerAed);
    setMgmtPct(data.managementSharePct);
    setMgmtInvestor(data.settings.managementInvestorId ?? '');
    setBook('AED');
    setInvestorId(data.investors.find(i => !i.isHouse)?.id ?? data.investors[0]?.id ?? '');
    setBankId('');
    setAmount(0);
    setLotDate(defaultDate);
    setVoucherDate(defaultDate);
  }, [open, kind, data, defaultDate]);

  useEffect(() => {
    if (!bankId && banks[0]) setBankId(banks[0].id);
  }, [banks, bankId]);

  const showBookToggle = kind === 'deposit' || kind === 'withdraw' || kind === 'payout';

  const canSubmit = useMemo(() => {
    if (disabled || saving) return false;
    if (kind === 'opening' && data.openingLocked) return false;
    if (kind === 'investor') return name.trim().length > 0;
    if (kind === 'deposit' || kind === 'withdraw' || kind === 'payout') {
      return Boolean(investorId && bankId && amount > 0);
    }
    return true;
  }, [kind, data.openingLocked, name, investorId, bankId, amount, disabled, saving]);

  const handleSubmit = () => {
    void onSubmit(
      kind === 'investor'
        ? { name: name.trim(), notes }
        : kind === 'opening'
          ? {
              openingAed,
              openingInr,
              openingInrPerAed: inrPerAed,
              voucherDate,
            }
          : kind === 'management'
            ? {
                managementSharePct: mgmtPct,
                managementInvestorId: mgmtInvestor || null,
              }
            : {
                investorId,
                book,
                amount,
                inrPerAed: book === 'INR' ? inrPerAed : undefined,
                bankAccountId: bankId,
                lotDate,
                notes,
              },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={copy.title}
      maxWidth={copy.maxWidth}
      maxHeight="sm:max-h-[min(88dvh,720px)]"
      bodyClassName="!px-4 !py-3 sm:!px-5"
      headerCenter={showBookToggle ? <CapitalBookToggle value={book} onChange={setBook} disabled={saving} /> : undefined}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={btnPrimary} disabled={!canSubmit} onClick={handleSubmit}>
            {saving ? 'Saving…' : copy.submit}
          </button>
        </>
      }
    >
      <h3 className={icFormSectionEyebrow}>{summarySectionTitle(kind)}</h3>
      <div className={`${asicFormGrid} mt-2 gap-y-3`}>
        {kind === 'investor' ? (
          <>
            <AsicFormField label="Investor name *" htmlFor="cap-inv-name" colSpan={12}>
              <input
                id="cap-inv-name"
                className={denseInput}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Legal or display name"
                autoFocus
              />
            </AsicFormField>
            <AsicFormField label="Notes" htmlFor="cap-inv-notes" colSpan={12}>
              <textarea
                id="cap-inv-notes"
                className={`${asicTextarea} ${icPurchaseDenseInput} min-h-[4.5rem]`}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional"
              />
            </AsicFormField>
          </>
        ) : null}

        {kind === 'opening' ? (
          <>
            {data.openingLocked ? (
              <div className="sm:col-span-2 lg:col-span-12">
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                  Opening capital is locked. Adjust balances through the books if required.
                </p>
              </div>
            ) : (
              <>
                <AsicFormField label="Opening AED" colSpan={4}>
                  <FormattedNumberInput
                    value={openingAed}
                    onNumericChange={setOpeningAed}
                    book="aed"
                    className={denseInput}
                  />
                </AsicFormField>
                <AsicFormField label="Opening INR" colSpan={4}>
                  <FormattedNumberInput
                    value={openingInr}
                    onNumericChange={setOpeningInr}
                    book="inr"
                    className={denseInput}
                  />
                </AsicFormField>
                <AsicFormField label="INR per 1 AED" colSpan={4}>
                  <FormattedNumberInput
                    value={inrPerAed}
                    onNumericChange={setInrPerAed}
                    book="inr"
                    className={denseInput}
                  />
                </AsicFormField>
                <AsicFormField label="Effective date" htmlFor="cap-open-date" colSpan={6}>
                  <input
                    id="cap-open-date"
                    type="date"
                    className={denseInput}
                    value={voucherDate}
                    onChange={e => setVoucherDate(e.target.value)}
                  />
                </AsicFormField>
              </>
            )}
          </>
        ) : null}

        {kind === 'management' ? (
          <>
            <AsicFormField label="Management % of profit" htmlFor="cap-mgmt-pct" colSpan={6}>
              <input
                id="cap-mgmt-pct"
                type="number"
                step="0.01"
                min="0"
                max="100"
                className={denseInput}
                value={mgmtPct}
                onChange={e => setMgmtPct(Number(e.target.value) || 0)}
              />
            </AsicFormField>
            <AsicFormField label="Receiver investor" htmlFor="cap-mgmt-inv" colSpan={6}>
              <select
                id="cap-mgmt-inv"
                className={denseInput}
                value={mgmtInvestor}
                onChange={e => setMgmtInvestor(e.target.value)}
              >
                <option value="">HQ (default)</option>
                {data.investors.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </AsicFormField>
          </>
        ) : null}

        {showBookToggle ? (
          <>
            <SectionEyebrow>Settlement</SectionEyebrow>
            <AsicFormField label="Investor *" htmlFor="cap-mov-inv" colSpan={6}>
              <select
                id="cap-mov-inv"
                className={denseInput}
                value={investorId}
                onChange={e => setInvestorId(e.target.value)}
              >
                {data.investors.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                    {i.isHouse ? ' (HQ)' : ''}
                  </option>
                ))}
              </select>
            </AsicFormField>
            <AsicFormField label="HQ bank account *" htmlFor="cap-mov-bank" colSpan={6}>
              <select
                id="cap-mov-bank"
                className={denseInput}
                value={bankId}
                onChange={e => setBankId(e.target.value)}
              >
                {banks.length === 0 ? (
                  <option value="">No bank accounts</option>
                ) : (
                  banks.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))
                )}
              </select>
            </AsicFormField>
            <AsicFormField label="Amount *" colSpan={6}>
              <FormattedNumberInput
                value={amount}
                onNumericChange={setAmount}
                book={book === 'INR' ? 'inr' : 'aed'}
                className={denseInput}
              />
            </AsicFormField>
            <AsicFormField label="Lot date" htmlFor="cap-mov-date" colSpan={6}>
              <input
                id="cap-mov-date"
                type="date"
                className={denseInput}
                value={lotDate}
                onChange={e => setLotDate(e.target.value)}
              />
            </AsicFormField>
            {book === 'INR' ? (
              <AsicFormField label="INR per 1 AED" colSpan={6}>
                <FormattedNumberInput
                  value={inrPerAed}
                  onNumericChange={setInrPerAed}
                  book="inr"
                  className={denseInput}
                />
              </AsicFormField>
            ) : null}
            <AsicFormField label="Notes" htmlFor="cap-mov-notes" colSpan={12}>
              <textarea
                id="cap-mov-notes"
                className={`${asicTextarea} ${icPurchaseDenseInput} min-h-[3.5rem]`}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional reference"
              />
            </AsicFormField>
          </>
        ) : null}

      </div>
    </Modal>
  );
}

function summarySectionTitle(kind: CapitalModalKind): string {
  switch (kind) {
    case 'investor':
      return 'Investor profile';
    case 'opening':
      return 'Opening balances';
    case 'management':
      return 'Profit sharing';
    case 'deposit':
    case 'withdraw':
    case 'payout':
      return 'Transaction';
    default:
      return 'Details';
  }
}
