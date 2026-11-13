'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { SmoothModeSwap } from '@/components/ui/SmoothHeight';
import { asicInput } from '@/components/asic/ui';
import { btnPrimary, btnSecondary } from '@/lib/ui';
import { useApp } from '@/context/AppContext';
import { createBranchDepositAction } from '@/app/actions/branchDepositActions';
import ManagerCustomerFields from '@/components/ic-transfer/shared/ManagerCustomerFields';
import SettlementModeToggle from '@/components/ic-transfer/shared/SettlementModeToggle';
import FormattedNumberInput from '@/components/ic-transfer/shared/FormattedNumberInput';
import PartyLedgerStrip from '@/components/ic-transfer/shared/PartyLedgerStrip';
import { formatAmount } from '@/lib/icTransfer/rateCalculations';
import {
  computeImpliedMetalRateAedPerG,
  METAL_AMOUNT_DECIMALS,
  METAL_WEIGHT_DECIMALS,
  type ICSettlementMode,
} from '@/lib/icTransfer/metalSettlement';
import { roundLedgerAmount } from '@/lib/icFunds/currencyPolicy';
import { useICTransferModalSnapshots } from '@/lib/icTransfer/useICTransferModalSnapshots';
import { FmtLedgerAed } from '@/lib/icFunds/format';
import { formatMetalGrams } from '@/lib/icTransfer/warehouseMatrixMetrics';
import type { ICBranch } from '@/types';
import { HQ_IC_FUNDS_BRANCH_SLUG } from '@/lib/icFunds/hqBranch';
import {
  icFormSectionEyebrow,
  icPurchaseDenseInput,
  icPurchaseDenseLabel,
  icPurchaseFormModalBody,
  icPurchaseModalShell,
} from '@/components/ic-transfer/shared/icTransferFormModalLayout';

type Props = {
  open: boolean;
  branch: ICBranch;
  branchSlug: string;
  onClose: () => void;
  onSaved?: () => void;
};

const denseInput = `${asicInput} ${icPurchaseDenseInput}`;
const fieldLabel = `${icPurchaseDenseLabel} mb-1`;
const leftTopGrid = 'grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2';
const metalAmountPairRow = 'grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2';
const notesInput = `${asicInput} ${icPurchaseDenseInput} !min-h-9 max-h-9 resize-none py-1 text-sm leading-snug`;

function DepositField({
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
      <label className={fieldLabel}>{label}</label>
      {children}
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

export default function BranchDepositModal({
  open,
  branch,
  branchSlug,
  onClose,
  onSaved,
}: Props) {
  const { icSuppliers, showToast } = useApp();
  const [managerId, setManagerId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [settlementMode, setSettlementMode] = useState<ICSettlementMode>('cash');
  const [cashAmountAed, setCashAmountAed] = useState(0);
  const [metalWeightG, setMetalWeightG] = useState(0);
  const [metalRateAedPerG, setMetalRateAedPerG] = useState(0);
  const [metalTotalAed, setMetalTotalAed] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  const { entityLedgerById } = useICTransferModalSnapshots(open);

  const actionSlug = branchSlug?.trim() || HQ_IC_FUNDS_BRANCH_SLUG;

  const selectedCustomer = useMemo(
    () => icSuppliers.find(c => c.id === customerId) ?? null,
    [icSuppliers, customerId],
  );

  const isMetal = settlementMode === 'metal';

  const totalAed = isMetal ? roundLedgerAmount(metalTotalAed) : roundLedgerAmount(cashAmountAed);

  useEffect(() => {
    if (!open) return;
    setNow(new Date());
    setManagerId('');
    setCustomerId('');
    setSettlementMode('cash');
    setCashAmountAed(0);
    setMetalWeightG(0);
    setMetalRateAedPerG(0);
    setMetalTotalAed(0);
    setNotes('');
  }, [open]);

  const onMetalWeight = (n: number) => {
    setMetalWeightG(n);
    if (metalRateAedPerG > 0) setMetalTotalAed(roundLedgerAmount(n * metalRateAedPerG));
    else if (metalTotalAed > 0 && n > 0) {
      setMetalRateAedPerG(computeImpliedMetalRateAedPerG(n, metalTotalAed));
    }
  };

  const onMetalRate = (n: number) => {
    setMetalRateAedPerG(n);
    if (metalWeightG > 0) setMetalTotalAed(roundLedgerAmount(metalWeightG * n));
  };

  const onMetalTotal = (n: number) => {
    setMetalTotalAed(n);
    if (metalWeightG > 0) setMetalRateAedPerG(computeImpliedMetalRateAedPerG(metalWeightG, n));
  };

  const canSubmit =
    !saving &&
    managerId &&
    customerId &&
    totalAed > 0 &&
    (isMetal ? metalWeightG > 0 && metalRateAedPerG > 0 : cashAmountAed > 0);

  const breakdownItems = useMemo(() => {
    if (isMetal) {
      return [
        { id: 'w', label: 'Weight', value: formatMetalGrams(metalWeightG) },
        { id: 'r', label: 'Rate (AED/g)', value: formatAmount(metalRateAedPerG) },
        {
          id: 't',
          label: 'Total (AED)',
          value: <FmtLedgerAed amount={totalAed} />,
          strong: true,
        },
      ];
    }
    return [
      {
        id: 'aed',
        label: 'Cash (AED)',
        value: <FmtLedgerAed amount={totalAed} />,
        strong: true,
      },
    ];
  }, [isMetal, metalWeightG, metalRateAedPerG, totalAed, cashAmountAed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    const res = await createBranchDepositAction(actionSlug, {
      icBranchId: branch.id,
      managerId,
      customerId,
      settlementMode,
      amountAed: totalAed,
      metalWeightG: isMetal ? metalWeightG : null,
      metalRateAedPerG: isMetal ? metalRateAedPerG : null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (!res.success) {
      showToast(res.error || 'Deposit failed', 'error');
      return;
    }
    showToast('Deposit recorded');
    onSaved?.();
    onClose();
  };

  const timestampBadge = (
    <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium tabular-nums text-slate-600 sm:px-2.5 sm:text-xs">
      {now ? formatModalTimestamp(now) : '…'}
    </span>
  );

  return (
    <Modal
      open={open}
      onRequestClose={onClose}
      onClose={onClose}
      title="Branch deposit"
      headerCenter={
        <SettlementModeToggle
          value={settlementMode}
          onChange={setSettlementMode}
          disabled={saving}
        />
      }
      headerTrailing={timestampBadge}
      maxWidth="max-w-6xl w-[96vw]"
      maxHeight={icPurchaseModalShell}
      heightClass="lg:h-[min(90vh,880px)]"
      bodyClassName={`${icPurchaseFormModalBody} !px-5 !py-2 lg:overflow-hidden`}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            form="branch-deposit-form"
            className={btnPrimary}
            disabled={!canSubmit}
          >
            {saving ? 'Saving…' : 'Save deposit'}
          </button>
        </>
      }
    >
      <form
        id="branch-deposit-form"
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col lg:min-h-0"
      >
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-12 lg:items-stretch">
          <div className="flex min-h-0 flex-col gap-1.5 lg:col-span-8 lg:min-h-0">
            <div className={leftTopGrid}>
              <ManagerCustomerFields
                managerId={managerId}
                customerId={customerId}
                onManagerChange={id => {
                  setManagerId(id);
                  setCustomerId('');
                }}
                onCustomerChange={setCustomerId}
                mode="sale"
                allowedManagerIds={
                  branch.managerIds?.length ? branch.managerIds : []
                }
                entityLedgerById={entityLedgerById}
                disabled={saving}
              />
              <DepositField label="Branch">
                <input
                  className={`${denseInput} cursor-not-allowed bg-slate-50 text-slate-700`}
                  readOnly
                  disabled
                  value={branch.name}
                />
              </DepositField>
            </div>

            <div className="border-t border-slate-200 pt-1.5">
              <SmoothModeSwap mode={settlementMode}>
                {isMetal ? (
                  <div className={metalAmountPairRow}>
                    <DepositField label="Weight (g) *">
                      <FormattedNumberInput
                        className={denseInput}
                        book="inr"
                        maxFractionDigits={METAL_WEIGHT_DECIMALS}
                        disabled={saving}
                        value={metalWeightG}
                        onNumericChange={onMetalWeight}
                      />
                    </DepositField>
                    <DepositField label="Rate (AED/g) *">
                      <FormattedNumberInput
                        className={denseInput}
                        book="aed"
                        maxFractionDigits={METAL_AMOUNT_DECIMALS}
                        disabled={saving}
                        value={metalRateAedPerG}
                        onNumericChange={onMetalRate}
                      />
                    </DepositField>
                    <DepositField label="Total (AED) *" className="sm:col-span-2 max-w-md">
                      <FormattedNumberInput
                        className={denseInput}
                        book="aed"
                        maxFractionDigits={METAL_AMOUNT_DECIMALS}
                        disabled={saving}
                        value={metalTotalAed}
                        onNumericChange={onMetalTotal}
                      />
                    </DepositField>
                  </div>
                ) : (
                  <div className={leftTopGrid}>
                    <DepositField label="Amount (AED) *" className="sm:col-span-2 max-w-md">
                      <FormattedNumberInput
                        className={denseInput}
                        book="aed"
                        maxFractionDigits={METAL_AMOUNT_DECIMALS}
                        disabled={saving}
                        value={cashAmountAed}
                        onNumericChange={setCashAmountAed}
                      />
                    </DepositField>
                  </div>
                )}
              </SmoothModeSwap>
            </div>
          </div>

          <aside className="flex min-h-0 flex-col gap-2 lg:col-span-4 lg:border-l lg:border-slate-200 lg:pl-4">
            {customerId ? (
              <PartyLedgerStrip
                counterpartyId={customerId}
                partyLabel={selectedCustomer?.name}
                book="AED"
                balances={entityLedgerById[customerId]}
              />
            ) : null}
            <h3 className={icFormSectionEyebrow}>Deposit summary</h3>
            <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-200 bg-slate-50/50">
              <ul className="flex-1 space-y-0 divide-y divide-slate-200/80 px-3 py-1">
                {breakdownItems.map(item => (
                  <li
                    key={item.id}
                    className="flex items-baseline justify-between gap-3 py-2 text-xs"
                  >
                    <span className="text-slate-500">{item.label}</span>
                    <span
                      className={`text-right font-mono text-xs tabular-nums ${
                        item.strong ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'
                      }`}
                    >
                      {item.value}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="space-y-2 border-t border-slate-200 bg-white px-3 py-3">
                {isMetal ? (
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Metal
                    </span>
                    <span className="font-mono text-sm font-bold tabular-nums text-slate-900">
                      {formatMetalGrams(metalWeightG)}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Credit customer (AED)
                  </span>
                  <span className="font-mono text-sm font-bold tabular-nums text-emerald-800">
                    <FmtLedgerAed amount={totalAed} />
                  </span>
                </div>
              </div>
            </div>
            <DepositField label="Notes">
              <textarea
                className={notesInput}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={saving}
                rows={2}
              />
            </DepositField>
          </aside>
        </div>
      </form>
    </Modal>
  );
}
