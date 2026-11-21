'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import AsicFormField from '@/components/asic/AsicFormField';
import { asicInput } from '@/components/asic/ui';
import AccountPicker from '@/components/ic-funds/AccountPicker';
import IcFundsBookToggle from '@/components/ic-funds/IcFundsBookToggle';
import ICTransferModalFormFooter from '@/components/ic-transfer/shared/ICTransferModalFormFooter';
import FormattedNumberInput from '@/components/ic-transfer/shared/FormattedNumberInput';
import ManagerCustomerFields from '@/components/ic-transfer/shared/ManagerCustomerFields';
import ICTransferFormField from '@/components/ic-transfer/shared/ICTransferFormField';
import PartyLedgerStrip from '@/components/ic-transfer/shared/PartyLedgerStrip';
import PartyCustomerAedDealsPanel from '@/components/ic-transfer/shared/PartyCustomerAedDealsPanel';
import OptionalVoucherAedAgentField from '@/components/ic-transfer/shared/OptionalVoucherAedAgentField';
import {
  icPurchaseModalShell,
  icPurchaseFormModalBody,
  icFormModalGridClass,
  icFormLeftPanelClass,
  icFormSectionEyebrow,
  icPurchaseDenseInput,
  icPurchaseDenseLabel,
  icVoucherPartyFieldsGrid,
  icVoucherPartyFieldsGridTwoCol,
  icVoucherModalFieldGrid,
  icVoucherDateAmountFieldClass,
  icVoucherFullRowFieldClass,
} from '@/components/ic-transfer/shared/icTransferFormModalLayout';
import {
  ensureICBranchLockerAccountAction,
  postICFundVoucherAction,
  listICFundAccountsLiteAction,
} from '@/app/actions/icFundsActions';
import { allowedAccountTypesForVoucher, voucherFieldLabels } from '@/lib/icFunds/voucherRules';
import { IC_FUND_VOUCHER_LABELS } from '@/lib/icFunds/constants';
import {
  icBranchIdFromCashAccount,
  isCashBankLedgerAccount,
  isVoucherNonCashSideAccount,
  isVoucherPartyAccount,
} from '@/lib/icFunds/voucherPartyAccounts';
import { useICTransferModalSnapshots } from '@/lib/icTransfer/useICTransferModalSnapshots';
import { useApp } from '@/context/AppContext';
import {
  counterpartyIdsFromVoucherAccounts,
  notifyIcFundsVoucherPosted,
} from '@/lib/icFunds/voucherPostedNotify';
import type { ICFundAccount } from '@/types';
import type { ICFundVoucherType } from '@/lib/icFunds/constants';

type Props = {
  open: boolean;
  branchId: string;
  voucherType: Extract<ICFundVoucherType, 'payment' | 'receipt'>;
  book: 'AED' | 'INR';
  onBookChange?: (book: 'AED' | 'INR') => void;
  lockBook?: boolean;
  defaultVoucherDate: string;
  initialOtherAccountId?: string;
  /** When set, cash/bank is locked to this UAE branch locker (AED). */
  fixedIcBranchId?: string;
  onClose: () => void;
  onSaved?: () => void;
};

const denseInput = `${asicInput} ${icPurchaseDenseInput}`;
const CASH_TYPES = allowedAccountTypesForVoucher('payment', 'credit');

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <h3 className={icFormSectionEyebrow}>{children}</h3>;
}

function formatModalTimestamp(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function IcFundsAccountVoucherModal({
  open,
  branchId,
  voucherType,
  book,
  onBookChange,
  lockBook,
  defaultVoucherDate,
  initialOtherAccountId,
  fixedIcBranchId,
  onClose,
  onSaved,
}: Props) {
  const { showToast, icBranches } = useApp();
  const labels = voucherFieldLabels(voucherType);
  const [accounts, setAccounts] = useState<ICFundAccount[]>([]);
  const [voucherDate, setVoucherDate] = useState(defaultVoucherDate);
  const [cashId, setCashId] = useState('');
  const [otherId, setOtherId] = useState('');
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [managerId, setManagerId] = useState('');
  const [aedAgentId, setAedAgentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  const { entityLedgerById } = useICTransferModalSnapshots(open);

  const loadAccounts = useCallback(async () => {
    if (fixedIcBranchId && book === 'AED') {
      const ensured = await ensureICBranchLockerAccountAction(fixedIcBranchId);
      if (!ensured.success) {
        setAccounts([]);
        showToast(ensured.error, 'error');
        return;
      }
    }
    const lite = await listICFundAccountsLiteAction(branchId, book);
    setAccounts(lite);
  }, [branchId, book, fixedIcBranchId, showToast]);

  useEffect(() => {
    if (!open) return;
    setNow(new Date());
    setVoucherDate(defaultVoucherDate);
    setCashId('');
    setOtherId('');
    setAmount(0);
    setNotes('');
    setManagerId('');
    setAedAgentId('');
    void loadAccounts();
  }, [open, defaultVoucherDate, loadAccounts]);

  useEffect(() => {
    if (!open) return;
    setCashId('');
    setOtherId('');
    void loadAccounts();
  }, [book, open, loadAccounts]);

  const cashAccount = accounts.find(a => a.id === cashId);
  const otherAccount = accounts.find(a => a.id === otherId);
  const icBranchId = fixedIcBranchId ?? icBranchIdFromCashAccount(cashAccount);

  const allowedManagerIds = useMemo(() => {
    if (!icBranchId) return undefined;
    const branch = icBranches.find(b => b.id === icBranchId);
    const ids = branch?.managerIds ?? [];
    return ids.length ? ids : null;
  }, [icBranchId, icBranches]);

  useEffect(() => {
    if (!open || !initialOtherAccountId || accounts.length === 0) return;
    if (!accounts.some(a => a.id === initialOtherAccountId)) return;
    setOtherId(initialOtherAccountId);
  }, [open, initialOtherAccountId, accounts]);

  useEffect(() => {
    if (!open || !fixedIcBranchId || accounts.length === 0) return;
    const till = accounts.find(
      a =>
        isCashBankLedgerAccount(a) &&
        (a.sourceType ?? '').toLowerCase() === 'ic_branch' &&
        String(a.sourceId) === fixedIcBranchId,
    );
    if (till) setCashId(till.id);
  }, [open, fixedIcBranchId, accounts]);

  useEffect(() => {
    if (!open || !icBranchIdFromCashAccount(cashAccount)) return;
    if (book !== 'AED' && onBookChange) onBookChange('AED');
  }, [cashAccount, book, onBookChange, open]);

  const requiresManager = Boolean(icBranchId);
  const otherIsCustomer =
    otherAccount &&
    isVoucherPartyAccount(otherAccount) &&
    (otherAccount.sourceType ?? '').toLowerCase() === 'ic_counterparty';
  const showBalancesAside = Boolean(otherIsCustomer && otherAccount?.sourceId);

  const debitId = voucherType === 'payment' ? otherId : cashId;
  const creditId = voucherType === 'payment' ? cashId : otherId;

  const canSubmit =
    Boolean(cashId && otherId && voucherDate && amount > 0 && debitId !== creditId) &&
    (!requiresManager || managerId.trim());

  const title = voucherType === 'receipt' ? 'Record receipt' : 'Record payment';

  const handleSave = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    const result = await postICFundVoucherAction({
      branchId,
      voucherType,
      voucherDate,
      debitAccountId: debitId,
      creditAccountId: creditId,
      amount,
      notes,
      book,
      managerId: requiresManager ? managerId : undefined,
      aedAgentId: aedAgentId.trim() || null,
      idempotencyKey: crypto.randomUUID(),
    });
    setSaving(false);
    if (!result.success) {
      showToast(result.error, 'error');
      return;
    }
    showToast(`${IC_FUND_VOUCHER_LABELS[voucherType].slice(0, -1)} saved`, 'success');
    const counterpartyIds = counterpartyIdsFromVoucherAccounts(accounts, debitId, creditId);
    notifyIcFundsVoucherPosted(counterpartyIds.length > 0 ? { counterpartyIds } : undefined);
    onSaved?.();
    onClose();
  };

  const branchBookLocked = lockBook || Boolean(fixedIcBranchId);
  const allowInrToggle = !branchBookLocked && !icBranchIdFromCashAccount(cashAccount);

  const headerCenter = branchBookLocked ? (
    <span className="shrink-0 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-900 sm:text-xs">
      AED
    </span>
  ) : (
    <IcFundsBookToggle
      value={book}
      onChange={b => onBookChange?.(b)}
      allowInr={allowInrToggle}
      size="md"
    />
  );

  const cashLabel = voucherType === 'payment' ? labels.credit : labels.debit;
  const otherLabel = voucherType === 'payment' ? labels.debit : labels.credit;

  const fixedBranch = fixedIcBranchId ? icBranches.find(b => b.id === fixedIcBranchId) : null;

  const timestampBadge = (
    <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium tabular-nums text-slate-600 sm:px-2.5 sm:text-xs">
      {now ? formatModalTimestamp(now) : '…'}
    </span>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      headerCenter={headerCenter}
      headerTrailing={timestampBadge}
      maxWidth="max-w-6xl w-[96vw]"
      maxHeight={icPurchaseModalShell}
      heightClass="lg:h-[min(90vh,880px)]"
      bodyClassName={`${icPurchaseFormModalBody} !px-5 !py-2 lg:!overflow-hidden`}
      footerClassName="flex shrink-0 border-t border-slate-200 bg-white p-2 sm:p-3 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]"
      footer={
        <ICTransferModalFormFooter
          onCancel={onClose}
          cancelDisabled={saving}
          submitFormId="ic-funds-payment-receipt-form"
          submitLabel={saving ? 'Saving…' : voucherType === 'receipt' ? 'Save receipt' : 'Save payment'}
          submitDisabled={saving || !canSubmit}
          notes={notes}
          onNotesChange={setNotes}
          notesDisabled={saving}
          notesId="ic-funds-payment-receipt-notes"
          notesPlaceholder="Internal remark…"
        />
      }
    >
      <form
        id="ic-funds-payment-receipt-form"
        className="flex min-h-0 flex-1 flex-col lg:min-h-0"
        onSubmit={e => {
          e.preventDefault();
          void handleSave();
        }}
      >
        <div className={icFormModalGridClass}>
          <div
            className={`${icFormLeftPanelClass} gap-2.5 w-full min-w-0${showBalancesAside ? '' : ' lg:col-span-12'}`}
          >
            <SectionEyebrow>Cash / bank &amp; account</SectionEyebrow>
            <div className={icVoucherModalFieldGrid}>
              {fixedBranch ? (
                <AsicFormField
                  label="Branch locker"
                  colSpan={12}
                  className={icVoucherFullRowFieldClass}
                  labelClassName={`${icPurchaseDenseLabel} mb-1`}
                >
                  <input
                    className={`${denseInput} cursor-not-allowed bg-slate-50 text-slate-700`}
                    readOnly
                    disabled
                    value={fixedBranch.name}
                  />
                </AsicFormField>
              ) : (
                <AsicFormField
                  label={`${cashLabel} *`}
                  colSpan={12}
                  className={icVoucherFullRowFieldClass}
                  labelClassName={`${icPurchaseDenseLabel} mb-1`}
                >
                  <AccountPicker
                    label={cashLabel}
                    hideLabel
                    accounts={accounts}
                    allowedTypes={CASH_TYPES}
                    value={cashId}
                    excludeId={otherId}
                    onChange={setCashId}
                    book={book}
                    accountFilter={isCashBankLedgerAccount}
                  />
                </AsicFormField>
              )}
              {requiresManager ? (
                <div
                  className={
                    book === 'AED' ? icVoucherPartyFieldsGrid : icVoucherPartyFieldsGridTwoCol
                  }
                >
                  <ManagerCustomerFields
                    managerOnly
                    inline
                    contentsGrid
                    inputClassName={denseInput}
                    allowedManagerIds={allowedManagerIds}
                    mode="purchase"
                    managerId={managerId}
                    customerId=""
                    onManagerChange={id => setManagerId(id)}
                    onCustomerChange={() => undefined}
                    entityLedgerById={entityLedgerById}
                    disabled={saving}
                    branchId={icBranchId ?? undefined}
                  />
                  <ICTransferFormField label={`${otherLabel} *`} compact className="min-w-0">
                    <AccountPicker
                      label={otherLabel}
                      hideLabel
                      compact
                      inputClassName={denseInput}
                      accounts={accounts}
                      allowedTypes={allowedAccountTypesForVoucher(voucherType, voucherType === 'payment' ? 'debit' : 'credit')}
                      value={otherId}
                      excludeId={cashId}
                      onChange={id => {
                        setOtherId(id);
                      }}
                      book={book}
                      accountFilter={isVoucherNonCashSideAccount}
                    />
                  </ICTransferFormField>
                  {book === 'AED' ? (
                    <OptionalVoucherAedAgentField
                      open={open}
                      value={aedAgentId}
                      onChange={setAedAgentId}
                      disabled={saving}
                    />
                  ) : null}
                </div>
              ) : (
                <AsicFormField
                  label={`${otherLabel} *`}
                  colSpan={12}
                  className={icVoucherFullRowFieldClass}
                  labelClassName={`${icPurchaseDenseLabel} mb-1`}
                >
                  <AccountPicker
                    label={otherLabel}
                    hideLabel
                    accounts={accounts}
                    allowedTypes={allowedAccountTypesForVoucher(voucherType, voucherType === 'payment' ? 'debit' : 'credit')}
                    value={otherId}
                    excludeId={cashId}
                    onChange={id => {
                      setOtherId(id);
                      setManagerId('');
                    }}
                    book={book}
                    accountFilter={isVoucherNonCashSideAccount}
                  />
                </AsicFormField>
              )}
              <AsicFormField
                label="Voucher date *"
                colSpan={12}
                className={icVoucherDateAmountFieldClass}
                labelClassName={`${icPurchaseDenseLabel} mb-1`}
              >
                <input
                  type="date"
                  className={denseInput}
                  value={voucherDate}
                  onChange={e => setVoucherDate(e.target.value)}
                  disabled={saving}
                />
              </AsicFormField>
              <AsicFormField
                label={`Amount (${book}) *`}
                colSpan={12}
                className={icVoucherDateAmountFieldClass}
                labelClassName={`${icPurchaseDenseLabel} mb-1`}
              >
                <FormattedNumberInput
                  className={denseInput}
                  value={amount}
                  onNumericChange={setAmount}
                  book={book === 'INR' ? 'inr' : 'aed'}
                  disabled={saving}
                />
              </AsicFormField>
            </div>
          </div>
          {showBalancesAside ? (
            <aside className="flex min-h-0 flex-col gap-2 lg:col-span-4 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:border-l lg:border-slate-200 lg:pl-4 lg:pr-0.5">
              <SectionEyebrow>Balances</SectionEyebrow>
              <PartyLedgerStrip
                counterpartyId={String(otherAccount!.sourceId)}
                book={book}
                balances={entityLedgerById?.[String(otherAccount!.sourceId)]}
              />
              {book === 'AED' ? (
                <PartyCustomerAedDealsPanel
                  customerId={String(otherAccount!.sourceId)}
                  voucherType={voucherType}
                  disabled={saving}
                  onApplyDeal={({
                    amount: nextAmount,
                    notes: dealNotes,
                    managerId: dealManagerId,
                    aedAgentId: dealAgentId,
                  }) => {
                    setAmount(nextAmount);
                    setNotes(dealNotes);
                    if (dealManagerId && !managerId) setManagerId(dealManagerId);
                    if (dealAgentId && !aedAgentId) setAedAgentId(dealAgentId);
                  }}
                />
              ) : null}
            </aside>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
