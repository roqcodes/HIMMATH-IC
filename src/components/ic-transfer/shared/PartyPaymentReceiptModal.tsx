'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import AsicFormField from '@/components/asic/AsicFormField';
import { asicInput } from '@/components/asic/ui';
import { useApp } from '@/context/AppContext';
import { postPartyPaymentReceiptAction } from '@/app/actions/partyPaymentReceiptActions';
import ManagerCustomerFields from '@/components/ic-transfer/shared/ManagerCustomerFields';
import FormattedNumberInput from '@/components/ic-transfer/shared/FormattedNumberInput';
import PartyLedgerStrip from '@/components/ic-transfer/shared/PartyLedgerStrip';
import PartyCustomerAedDealsPanel from '@/components/ic-transfer/shared/PartyCustomerAedDealsPanel';
import OptionalVoucherAedAgentField from '@/components/ic-transfer/shared/OptionalVoucherAedAgentField';
import ICTransferModalFormFooter from '@/components/ic-transfer/shared/ICTransferModalFormFooter';
import { useICTransferModalSnapshots } from '@/lib/icTransfer/useICTransferModalSnapshots';
import {
  icPurchaseModalShell,
  icPurchaseFormModalBody,
  icFormModalGridClass,
  icFormLeftPanelClass,
  icFormSectionEyebrow,
  icPurchaseDenseInput,
  icPurchaseDenseLabel,
  icVoucherPartyFieldsGrid,
  icVoucherModalFieldGrid,
  icVoucherDateAmountFieldClass,
  icVoucherFullRowFieldClass,
} from '@/components/ic-transfer/shared/icTransferFormModalLayout';
import { FmtLedgerAed, FmtLedgerInr } from '@/lib/icFunds/format';
import IcFundsBookToggle from '@/components/ic-funds/IcFundsBookToggle';
import type { ICBranch, ICWarehouse } from '@/types';

export type PartyPrModalMode =
  | { book: 'AED'; icBranch: ICBranch }
  | { book: 'INR'; warehouse: ICWarehouse }
  | { book: 'AED' | 'INR'; pickLocation: true };

type Props = {
  open: boolean;
  mode: PartyPrModalMode;
  voucherType: 'payment' | 'receipt';
  defaultBook?: 'AED' | 'INR';
  onBookChange?: (book: 'AED' | 'INR') => void;
  onClose: () => void;
  onSaved?: () => void;
};

const denseInput = `${asicInput} ${icPurchaseDenseInput}`;
const fieldLabel = icPurchaseDenseLabel;

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <h3 className={icFormSectionEyebrow}>{children}</h3>;
}

function PrField({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <AsicFormField label={label} colSpan={12} labelClassName={`${fieldLabel} mb-1`}>
        {children}
      </AsicFormField>
    </div>
  );
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

export default function PartyPaymentReceiptModal({
  open,
  mode,
  voucherType,
  defaultBook,
  onBookChange,
  onClose,
  onSaved,
}: Props) {
  const { icBranches, icWarehouses, showToast, refreshAppData } = useApp();
  const [managerId, setManagerId] = useState('');
  const [aedAgentId, setAedAgentId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState(0);
  const [voucherDate, setVoucherDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [locationBook, setLocationBook] = useState<'AED' | 'INR'>(
    'pickLocation' in mode && mode.pickLocation ? 'AED' : mode.book,
  );
  const [icBranchId, setIcBranchId] = useState('icBranch' in mode ? mode.icBranch.id : '');
  const [warehouseId, setWarehouseId] = useState('warehouse' in mode ? mode.warehouse.id : '');
  const [allowedManagerIds, setAllowedManagerIds] = useState<string[] | null>(null);

  const lockedBook = 'pickLocation' in mode && mode.pickLocation ? locationBook : mode.book;
  const locationPickMode = 'pickLocation' in mode && mode.pickLocation;

  const { entityLedgerById } = useICTransferModalSnapshots(open);

  useEffect(() => {
    if (!open) return;
    setNow(new Date());
    setVoucherDate(new Date().toISOString().slice(0, 10));
    setAmount(0);
    setNotes('');
    setManagerId('');
    setAedAgentId('');
    setCustomerId('');
    if (locationPickMode && defaultBook) {
      setLocationBook(defaultBook);
    }
    if ('icBranch' in mode) {
      setIcBranchId(mode.icBranch.id);
      const ids = mode.icBranch.managerIds ?? [];
      setAllowedManagerIds(ids.length ? ids : null);
    } else if ('warehouse' in mode) {
      setWarehouseId(mode.warehouse.id);
      const ids = mode.warehouse.managerIds ?? [];
      setAllowedManagerIds(ids.length ? ids : null);
    } else {
      setAllowedManagerIds(null);
    }
  }, [open, mode, defaultBook, locationPickMode]);

  const setBook = (next: 'AED' | 'INR') => {
    setLocationBook(next);
    onBookChange?.(next);
  };

  useEffect(() => {
    if (!locationPickMode) return;
    if (locationBook === 'AED' && icBranchId) {
      const branch = icBranches.find(b => b.id === icBranchId);
      const ids = branch?.managerIds ?? [];
      setAllowedManagerIds(ids.length ? ids : null);
    } else if (locationBook === 'INR' && warehouseId) {
      const wh = icWarehouses.find(w => w.id === warehouseId);
      const ids = wh?.managerIds ?? [];
      setAllowedManagerIds(ids.length ? ids : null);
    } else {
      setAllowedManagerIds(null);
    }
  }, [locationBook, icBranchId, warehouseId, locationPickMode, icBranches, icWarehouses]);

  const lockedBranch = useMemo(() => {
    if (lockedBook !== 'AED' || !icBranchId) return null;
    return icBranches.find(b => b.id === icBranchId) ?? ('icBranch' in mode ? mode.icBranch : null);
  }, [lockedBook, icBranchId, icBranches, mode]);

  const lockedWarehouse = useMemo(() => {
    if (lockedBook !== 'INR' || !warehouseId) return null;
    return icWarehouses.find(w => w.id === warehouseId) ?? ('warehouse' in mode ? mode.warehouse : null);
  }, [lockedBook, warehouseId, icWarehouses, mode]);

  const branchTillAed = lockedBranch?.cashBalance ?? null;

  const title = voucherType === 'receipt' ? 'Record receipt' : 'Record payment';

  const canSubmit =
    managerId.trim() &&
    customerId.trim() &&
    amount > 0 &&
    (lockedBook === 'AED' ? icBranchId.trim() : warehouseId.trim());

  const postingLines = useMemo(() => {
    if (lockedBook === 'AED') {
      return voucherType === 'receipt'
        ? { debit: 'Branch locker', credit: 'Customer AED' }
        : { debit: 'Customer AED', credit: 'Branch locker' };
    }
    return voucherType === 'receipt'
      ? { debit: 'Warehouse INR till', credit: 'Customer INR' }
      : { debit: 'Customer INR', credit: 'Warehouse INR till' };
  }, [lockedBook, voucherType]);

  const handleSave = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    const res = await postPartyPaymentReceiptAction({
      voucherType,
      voucherDate,
      amount,
      notes,
      managerId,
      aedAgentId: aedAgentId.trim() || null,
      customerId,
      book: lockedBook,
      icBranchId: lockedBook === 'AED' ? icBranchId : undefined,
      warehouseId: lockedBook === 'INR' ? warehouseId : undefined,
    });
    setSaving(false);
    if (!res.success) {
      showToast?.(res.error || 'Save failed', 'error');
      return;
    }
    showToast?.(voucherType === 'receipt' ? 'Receipt saved' : 'Payment saved', 'success');
    void refreshAppData?.();
    onSaved?.();
    onClose();
  };

  const timestampBadge = (
    <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium tabular-nums text-slate-600 sm:px-2.5 sm:text-xs">
      {now ? formatModalTimestamp(now) : '…'}
    </span>
  );

  const headerBook = locationPickMode ? (
    <IcFundsBookToggle value={lockedBook} onChange={setBook} size="md" />
  ) : (
    <span className="shrink-0 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-900 sm:text-xs">
      {lockedBook}
    </span>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      headerCenter={headerBook}
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
          submitFormId="party-pr-form"
          submitLabel={saving ? 'Saving…' : voucherType === 'receipt' ? 'Save receipt' : 'Save payment'}
          submitDisabled={saving || !canSubmit}
          notes={notes}
          onNotesChange={setNotes}
          notesDisabled={saving}
          notesId="party-pr-notes"
          notesPlaceholder="Internal remark…"
        />
      }
    >
      <form
        id="party-pr-form"
        className="flex min-h-0 flex-1 flex-col lg:min-h-0"
        onSubmit={e => {
          e.preventDefault();
          void handleSave();
        }}
      >
        <div className={icFormModalGridClass}>
          <div className={`${icFormLeftPanelClass} gap-2.5`}>
            <SectionEyebrow>Location &amp; parties</SectionEyebrow>
            <div className={leftTopGrid}>
              {locationPickMode ? (
                <>
                  {locationBook === 'AED' ? (
                    <PrField label="Branch *" className="sm:col-span-2">
                      <select
                        className={denseInput}
                        value={icBranchId}
                        onChange={e => setIcBranchId(e.target.value)}
                      >
                        <option value="">Select branch…</option>
                        {icBranches.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </PrField>
                  ) : (
                    <PrField label="Warehouse *" className="sm:col-span-2">
                      <select
                        className={denseInput}
                        value={warehouseId}
                        onChange={e => setWarehouseId(e.target.value)}
                      >
                        <option value="">Select warehouse…</option>
                        {icWarehouses.map(w => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </PrField>
                  )}
                </>
              ) : lockedBook === 'AED' ? (
                <PrField label="Branch" className="sm:col-span-2">
                  <input
                    className={`${denseInput} cursor-not-allowed bg-slate-50 text-slate-700`}
                    readOnly
                    disabled
                    value={lockedBranch?.name || 'Branch'}
                    aria-readonly
                  />
                </PrField>
              ) : (
                <PrField label="Warehouse" className="sm:col-span-2">
                  <input
                    className={`${denseInput} cursor-not-allowed bg-slate-50 text-slate-700`}
                    readOnly
                    disabled
                    value={lockedWarehouse?.name || 'Warehouse'}
                    aria-readonly
                  />
                </PrField>
              )}

              <div className={icVoucherPartyFieldsGrid}>
                <ManagerCustomerFields
                  contentsGrid
                  allowedManagerIds={allowedManagerIds}
                  mode="purchase"
                  managerId={managerId}
                  customerId={customerId}
                  onManagerChange={id => {
                    setManagerId(id);
                    setCustomerId('');
                  }}
                  onCustomerChange={setCustomerId}
                  entityLedgerById={entityLedgerById}
                  disabled={saving}
                />
                <OptionalVoucherAedAgentField
                  open={open}
                  value={aedAgentId}
                  onChange={setAedAgentId}
                  disabled={saving}
                />
              </div>
            </div>

            <SectionEyebrow>Amount</SectionEyebrow>
            <div className={leftTopGrid}>
              <PrField label="Voucher date *">
                <input
                  type="date"
                  className={denseInput}
                  value={voucherDate}
                  onChange={e => setVoucherDate(e.target.value)}
                  disabled={saving}
                />
              </PrField>
              <PrField label={`Amount (${lockedBook}) *`}>
                <FormattedNumberInput
                  className={denseInput}
                  value={amount}
                  onNumericChange={setAmount}
                  book={lockedBook === 'INR' ? 'inr' : 'aed'}
                  disabled={saving}
                />
              </PrField>
            </div>
          </div>

          <aside className="flex min-h-0 flex-col gap-2 lg:col-span-4 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:border-l lg:border-slate-200 lg:pl-4 lg:pr-0.5">
            <div className="flex flex-col gap-2">
              {lockedBook === 'AED' && lockedBranch ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-slate-600">Branch locker</span>
                    <span className="font-mono tabular-nums text-slate-900">
                      {branchTillAed != null ? <FmtLedgerAed amount={branchTillAed} /> : '—'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">{lockedBranch.name}</p>
                </div>
              ) : null}
              {customerId ? (
                <PartyLedgerStrip
                  counterpartyId={customerId}
                  book={lockedBook}
                  balances={entityLedgerById[customerId]}
                />
              ) : (
                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500">
                  Select a customer to see ledger balances.
                </p>
              )}
            </div>

            {lockedBook === 'AED' && customerId ? (
              <PartyCustomerAedDealsPanel
                customerId={customerId}
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

            <SectionEyebrow>Posting preview</SectionEyebrow>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50/50">
              <ul className="divide-y divide-slate-200/80 px-3 py-0.5 text-xs">
                <li className="flex items-baseline justify-between gap-3 py-2">
                  <span className="text-slate-500">Type</span>
                  <span className="font-semibold capitalize text-slate-800">{voucherType}</span>
                </li>
                <li className="flex items-baseline justify-between gap-3 py-2">
                  <span className="text-slate-500">Book</span>
                  <span className="font-semibold text-slate-800">{lockedBook}</span>
                </li>
                <li className="flex items-baseline justify-between gap-3 py-2">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-mono font-semibold tabular-nums text-slate-900">
                    {amount > 0 ? (
                      lockedBook === 'INR' ? (
                        <FmtLedgerInr amount={amount} />
                      ) : (
                        <FmtLedgerAed amount={amount} />
                      )
                    ) : (
                      '—'
                    )}
                  </span>
                </li>
              </ul>
              <div className="mt-auto space-y-2 border-t border-slate-200 bg-white px-3 py-3 text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-slate-500">Debit</span>
                  <span className="text-right font-medium text-slate-800">{postingLines.debit}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-slate-500">Credit</span>
                  <span className="text-right font-medium text-slate-800">{postingLines.credit}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </form>
    </Modal>
  );
}
