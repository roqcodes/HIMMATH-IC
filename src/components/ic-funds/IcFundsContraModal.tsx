'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import AsicFormField from '@/components/asic/AsicFormField';
import { asicInput } from '@/components/asic/ui';
import AccountPicker from '@/components/ic-funds/AccountPicker';
import ICTransferModalFormFooter from '@/components/ic-transfer/shared/ICTransferModalFormFooter';
import FormattedNumberInput from '@/components/ic-transfer/shared/FormattedNumberInput';
import {
  icPurchaseModalShell,
  icPurchaseFormModalBody,
  icFormModalGridClass,
  icFormLeftPanelClass,
  icFormSectionEyebrow,
  icPurchaseDenseInput,
  icPurchaseDenseLabel,
} from '@/components/ic-transfer/shared/icTransferFormModalLayout';
import { postICFundVoucherAction, listICFundAccountsLiteAction } from '@/app/actions/icFundsActions';
import { allowedAccountTypesForVoucher, voucherFieldLabels } from '@/lib/icFunds/voucherRules';
import { IC_FUND_VOUCHER_LABELS } from '@/lib/icFunds/constants';
import { useApp } from '@/context/AppContext';
import type { ICFundAccount } from '@/types';

type Props = {
  open: boolean;
  branchId: string;
  defaultVoucherDate: string;
  onClose: () => void;
  onSaved?: () => void;
};

const denseInput = `${asicInput} ${icPurchaseDenseInput}`;
const leftTopGrid = 'grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-2';
const BANK = allowedAccountTypesForVoucher('contra', 'debit');

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <h3 className={icFormSectionEyebrow}>{children}</h3>;
}

export default function IcFundsContraModal({
  open,
  branchId,
  defaultVoucherDate,
  onClose,
  onSaved,
}: Props) {
  const { showToast } = useApp();
  const labels = voucherFieldLabels('contra');
  const [accounts, setAccounts] = useState<ICFundAccount[]>([]);
  const [voucherDate, setVoucherDate] = useState(defaultVoucherDate);
  const [debitId, setDebitId] = useState('');
  const [creditId, setCreditId] = useState('');
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAccounts = useCallback(async () => {
    const lite = await listICFundAccountsLiteAction(branchId, 'AED');
    setAccounts(lite);
  }, [branchId]);

  useEffect(() => {
    if (!open) return;
    setVoucherDate(defaultVoucherDate);
    setDebitId('');
    setCreditId('');
    setAmount(0);
    setNotes('');
    void loadAccounts();
  }, [open, defaultVoucherDate, loadAccounts]);

  const canSubmit = Boolean(debitId && creditId && voucherDate && amount > 0 && debitId !== creditId);

  const headerCenter = (
    <span className="shrink-0 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-900 sm:text-xs">
      AED
    </span>
  );

  const handleSave = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    const result = await postICFundVoucherAction({
      branchId,
      voucherType: 'contra',
      voucherDate,
      debitAccountId: debitId,
      creditAccountId: creditId,
      amount,
      notes,
      book: 'AED',
      idempotencyKey: crypto.randomUUID(),
    });
    setSaving(false);
    if (!result.success) {
      showToast(result.error, 'error');
      return;
    }
    showToast('Contra saved', 'success');
    onSaved?.();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record contra"
      headerCenter={headerCenter}
      maxWidth="max-w-6xl w-[96vw]"
      maxHeight={icPurchaseModalShell}
      heightClass="lg:h-[min(90vh,880px)]"
      bodyClassName={`${icPurchaseFormModalBody} !px-5 !py-2 lg:!overflow-hidden`}
      footerClassName="flex shrink-0 border-t border-slate-200 bg-white p-2 sm:p-3 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]"
      footer={
        <ICTransferModalFormFooter
          onCancel={onClose}
          cancelDisabled={saving}
          submitFormId="ic-funds-contra-form"
          submitLabel={saving ? 'Saving…' : 'Save contra'}
          submitDisabled={saving || !canSubmit}
          notes={notes}
          onNotesChange={setNotes}
          notesDisabled={saving}
          notesId="ic-funds-contra-notes"
        />
      }
    >
      <form
        id="ic-funds-contra-form"
        className="flex min-h-0 flex-1 flex-col lg:min-h-0"
        onSubmit={e => {
          e.preventDefault();
          void handleSave();
        }}
      >
        <div className={icFormModalGridClass}>
          <div className={`${icFormLeftPanelClass} gap-2.5`}>
            <SectionEyebrow>Bank transfer</SectionEyebrow>
            <p className="text-xs text-slate-500">Move cash between AED bank / till accounts (HQ book).</p>
            <div className={leftTopGrid}>
              <AsicFormField label={labels.debit} colSpan={12} labelClassName={`${icPurchaseDenseLabel} mb-1`}>
                <AccountPicker
                  label={labels.debit}
                  accounts={accounts}
                  allowedTypes={BANK}
                  value={debitId}
                  excludeId={creditId}
                  onChange={setDebitId}
                  book="AED"
                />
              </AsicFormField>
              <AsicFormField label={labels.credit} colSpan={12} labelClassName={`${icPurchaseDenseLabel} mb-1`}>
                <AccountPicker
                  label={labels.credit}
                  accounts={accounts}
                  allowedTypes={BANK}
                  value={creditId}
                  excludeId={debitId}
                  onChange={setCreditId}
                  book="AED"
                />
              </AsicFormField>
              <AsicFormField label="Voucher date *" colSpan={12} labelClassName={`${icPurchaseDenseLabel} mb-1`}>
                <input
                  type="date"
                  className={denseInput}
                  value={voucherDate}
                  onChange={e => setVoucherDate(e.target.value)}
                  disabled={saving}
                />
              </AsicFormField>
              <AsicFormField label="Amount (AED) *" colSpan={12} labelClassName={`${icPurchaseDenseLabel} mb-1`}>
                <FormattedNumberInput
                  className={denseInput}
                  value={amount}
                  onNumericChange={setAmount}
                  book="aed"
                  disabled={saving}
                />
              </AsicFormField>
            </div>
          </div>
          <aside className="flex min-h-0 flex-col gap-2 lg:col-span-4 lg:min-h-0 lg:border-l lg:border-slate-200 lg:pl-4 lg:pr-0.5">
            <SectionEyebrow>Summary</SectionEyebrow>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-600">
              Contra entries are AED-only: bank ↔ bank within the IC Funds ledger.
            </div>
          </aside>
        </div>
      </form>
    </Modal>
  );
}
