'use client';

import React, { useEffect, useState } from 'react';
import { listCustomerAedDealsAction } from '@/app/actions/customerAedDealsActions';
import { FmtLedgerAed } from '@/lib/icFunds/format';
import { formatMetalGrams } from '@/lib/icTransfer/warehouseMatrixMetrics';
import { icFormSectionEyebrow } from '@/components/ic-transfer/shared/icTransferFormModalLayout';
import {
  settlementNoteForDeal,
  type CustomerAedDealLine,
  type CustomerAedDealsByWarehouse,
} from '@/lib/partyPayment/customerAedDeals';

type Props = {
  customerId: string;
  voucherType: 'payment' | 'receipt';
  warehouseId?: string | null;
  disabled?: boolean;
  onApplyDeal: (payload: {
    amount: number;
    notes: string;
    managerId?: string | null;
    aedAgentId?: string | null;
  }) => void;
};

function formatDealDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function DealRow({
  line,
  voucherType,
  disabled,
  onApply,
}: {
  line: CustomerAedDealLine;
  voucherType: 'payment' | 'receipt';
  disabled?: boolean;
  onApply: () => void;
}) {
  const expectPayment = line.kind === 'purchase';
  const expectReceipt = line.kind === 'sale';
  const matches =
    (voucherType === 'payment' && expectPayment) || (voucherType === 'receipt' && expectReceipt);
  const actionLabel = line.kind === 'purchase' ? 'Pay' : 'Receive';

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-slate-100 py-2 last:border-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span
            className={`shrink-0 rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ${
              line.kind === 'purchase'
                ? 'bg-violet-50 text-violet-800 ring-1 ring-violet-200/80'
                : 'bg-sky-50 text-sky-900 ring-1 ring-sky-200/80'
            }`}
          >
            {line.kind}
          </span>
          <span className="truncate text-xs font-semibold text-slate-800">{line.shortRef}</span>
          <span className="text-[10px] tabular-nums text-slate-400">{formatDealDate(line.dealDate)}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[11px] text-slate-600">
          <span className="font-mono font-semibold tabular-nums text-slate-900">
            <FmtLedgerAed amount={line.aedAmount} />
          </span>
          <span className="text-slate-400">·</span>
          <span>{line.paymentLabel}</span>
          {line.metalWeightG != null && line.metalWeightG > 0 ? (
            <>
              <span className="text-slate-400">·</span>
              <span className="tabular-nums">{formatMetalGrams(line.metalWeightG)}</span>
            </>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[10px] text-slate-500" title={line.aedAgentName ?? undefined}>
          Agent: {line.aedAgentName?.trim() || '—'}
        </p>
      </div>
      <button
        type="button"
        className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
          matches
            ? 'bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50'
            : 'cursor-not-allowed border border-slate-200 bg-slate-50 text-slate-400'
        }`}
        disabled={disabled || !matches}
        title={
          matches
            ? `Prefill ${actionLabel.toLowerCase()} for this ${line.kind}`
            : `${actionLabel} applies to ${line.kind} deals when recording ${line.kind === 'purchase' ? 'payments' : 'receipts'}`
        }
        onClick={onApply}
      >
        {actionLabel}
      </button>
    </div>
  );
}

function WarehouseBlock({
  group,
  voucherType,
  disabled,
  onApplyDeal,
}: {
  group: CustomerAedDealsByWarehouse;
  voucherType: 'payment' | 'receipt';
  disabled?: boolean;
  onApplyDeal: Props['onApplyDeal'];
}) {
  const totalLines = group.purchases.length + group.sales.length;
  const totalAed =
    group.purchases.reduce((s, l) => s + l.aedAmount, 0) + group.sales.reduce((s, l) => s + l.aedAmount, 0);

  return (
    <details className="group/wh rounded-lg border border-slate-200 bg-white" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="text-xs font-semibold text-slate-900">{group.warehouseName}</span>
        <span className="text-[10px] font-medium tabular-nums text-slate-500">
          {totalLines} deal{totalLines === 1 ? '' : 's'} · <FmtLedgerAed amount={totalAed} />
        </span>
      </summary>
      <div className="border-t border-slate-100 px-3 pb-1">
        {group.purchases.length > 0 ? (
          <div className="pt-1">
            <p className="pb-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700/90">Purchases</p>
            {group.purchases.map(line => (
              <DealRow
                key={line.id}
                line={line}
                voucherType={voucherType}
                disabled={disabled}
                onApply={() =>
                  onApplyDeal({
                    amount: line.aedAmount,
                    notes: settlementNoteForDeal(line),
                    managerId: line.managerId,
                    aedAgentId: line.aedAgentId,
                  })
                }
              />
            ))}
          </div>
        ) : null}
        {group.sales.length > 0 ? (
          <div className={group.purchases.length > 0 ? 'mt-2 border-t border-slate-100 pt-1' : 'pt-1'}>
            <p className="pb-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-800/90">Sales</p>
            {group.sales.map(line => (
              <DealRow
                key={line.id}
                line={line}
                voucherType={voucherType}
                disabled={disabled}
                onApply={() =>
                  onApplyDeal({
                    amount: line.aedAmount,
                    notes: settlementNoteForDeal(line),
                    managerId: line.managerId,
                    aedAgentId: line.aedAgentId,
                  })
                }
              />
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}

export default function PartyCustomerAedDealsPanel({
  customerId,
  voucherType,
  warehouseId,
  disabled,
  onApplyDeal,
}: Props) {
  const [groups, setGroups] = useState<CustomerAedDealsByWarehouse[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setGroups(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void listCustomerAedDealsAction({ counterpartyId: customerId, warehouseId }).then(rows => {
      if (cancelled) return;
      setGroups(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [customerId, warehouseId]);

  if (!customerId) return null;

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className={icFormSectionEyebrow}>AED metal deals</h3>
        <span className="text-[10px] text-slate-400">Agent AED · split leg</span>
      </div>
      {loading ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
          Loading deals…
        </div>
      ) : !groups || groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
          No metal purchases or sales with an AED leg for this party.
        </p>
      ) : (
        <div className="flex max-h-[min(22rem,40vh)] min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain pr-0.5">
          {groups.map(g => (
            <WarehouseBlock
              key={g.warehouseId}
              group={g}
              voucherType={voucherType}
              disabled={disabled}
              onApplyDeal={onApplyDeal}
            />
          ))}
        </div>
      )}
    </div>
  );
}