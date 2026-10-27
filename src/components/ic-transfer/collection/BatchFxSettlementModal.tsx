'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { btnPrimary, btnSecondary, formInput } from '@/lib/ui';
import { useApp } from '@/context/AppContext';
import { recordAgentFxSettlementAction, listFxSettlementPayToAccountsAction } from '@/app/actions/saleFxSettlementActions';
import AccountPicker from '@/components/ic-funds/AccountPicker';
import { FX_REMITTANCE_RECEIVE_TYPES } from '@/lib/icFunds/voucherRules';
import type { ICFundAccount, ICFundAccountType } from '@/types';
import {
  buildFifoAllocations,
  computeAgentGroupClosingSummary,
  computeSaleFxSettlementAmounts,
  formatFxAmount,
  sortSalesFifo,
  type FxOpenSaleLine,
} from '@/lib/icTransfer/saleFxProfit';
import { getFormattedTxnId } from '@/lib/icTransferMappers';
import CustomerProfileLink from '@/components/customers/CustomerProfileLink';
import { trackLoading } from '@/lib/loadingBar';

export type AgentGroupSale = {
  id: string;
  customerName: string;
  orderCustomerId?: string;
  customerBranchSlug?: string;
  customerKey?: string;
  currency: string;
  units: number;
  unitRate: number;
  aedAmount: number;
  convertedAmount: number;
  conversionRate: number;
  foreignRemaining: number;
  createdAt?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  collectionAccountId: string;
  collectionAccountName: string;
  sales: AgentGroupSale[];
  agentBalance?: number;
  branchSlug?: string;
  onSuccess: () => void;
};

function toOpenLine(sale: AgentGroupSale): FxOpenSaleLine {
  return {
    saleId: sale.id,
    units: sale.units,
    unitRate: sale.unitRate,
    aedAmount: sale.aedAmount,
    convertedAmount: sale.convertedAmount,
    conversionRate: sale.conversionRate,
    foreignRemaining: sale.foreignRemaining,
    createdAt: sale.createdAt,
  };
}

export default function BatchFxSettlementModal({
  open,
  onClose,
  collectionAccountId,
  collectionAccountName,
  sales,
  agentBalance,
  branchSlug,
  onSuccess,
}: Props) {
  const { showToast, branches } = useApp();
  const [paidForeign, setPaidForeign] = useState('');
  const [settlementRate, setSettlementRate] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [payToAccounts, setPayToAccounts] = useState<ICFundAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const remittanceBankTypes = useMemo(() => FX_REMITTANCE_RECEIVE_TYPES, []);

  const currency = sales[0]?.currency || '';

  const agentLines = useMemo(
    () => sortSalesFifo(sales.filter(s => s.foreignRemaining > 1e-10).map(toOpenLine)),
    [sales],
  );

  const saleById = useMemo(() => new Map(sales.map(s => [s.id, s])), [sales]);

  const agentOpening = useMemo(
    () => computeAgentGroupClosingSummary(agentLines, []),
    [agentLines],
  );

  const totalHeld = agentBalance ?? agentOpening.totalSarRemaining;

  useEffect(() => {
    if (!open) return;
    const lines = sortSalesFifo(sales.filter(s => s.foreignRemaining > 1e-10).map(toOpenLine));
    const opening = computeAgentGroupClosingSummary(lines, []);
    const held = agentBalance ?? opening.totalSarRemaining;
    setPaidForeign(held > 0 ? formatFxAmount(held) : '');
    setSettlementRate('');
    setToAccountId('');
    setNotes('');
  }, [open, collectionAccountId, sales, agentBalance]);

  useEffect(() => {
    if (!open) return;
    setAccountsLoading(true);
    void listFxSettlementPayToAccountsAction(branchSlug).then(res => {
      if (!res.success) {
        showToast(res.error || 'Failed to load pay-to accounts', 'error');
        setPayToAccounts([]);
      } else {
        setPayToAccounts(
          res.accounts.map(a => ({
            id: a.id,
            branchId: 'branch_hq',
            name: a.name,
            accountType: a.accountType as ICFundAccountType,
            status: 'active',
            openingBalance: 0,
            notes: '',
            createdAt: '',
            balance: a.balance,
          })),
        );
      }
      setAccountsLoading(false);
    });
  }, [open, branchSlug, showToast]);

  const paidNum = parseFloat(paidForeign);
  const rateNum = parseFloat(settlementRate);

  const fifoPreview = useMemo(() => {
    if (
      agentLines.length === 0 ||
      !Number.isFinite(paidNum) ||
      paidNum <= 0 ||
      !Number.isFinite(rateNum) ||
      rateNum <= 0
    ) {
      return null;
    }
    try {
      const allocations = buildFifoAllocations(agentLines, paidNum, rateNum);
      const closing = computeAgentGroupClosingSummary(agentLines, allocations);
      const rows = allocations.map(alloc => {
        const sale = agentLines.find(s => s.saleId === alloc.saleId)!;
        const line = computeSaleFxSettlementAmounts(
          alloc.paidForeign,
          alloc.settlementRate,
          sale.conversionRate,
        );
        return {
          saleId: sale.saleId,
          paidForeign: alloc.paidForeign,
          saleConversionRate: sale.conversionRate,
          settledAed: line.settledAed,
          type2ProfitAed: line.type2ProfitAed,
          remainingAfter: sale.foreignRemaining - alloc.paidForeign,
        };
      });
      return { allocations, closing, rows };
    } catch {
      return null;
    }
  }, [agentLines, paidNum, rateNum]);

  const submitBlockReason = useMemo(() => {
    if (agentLines.length === 0) return 'No open balance on this agent';
    if (!toAccountId) return 'Select paid-to account';
    if (!Number.isFinite(paidNum) || paidNum <= 0) return 'Enter paid amount';
    if (!Number.isFinite(rateNum) || rateNum <= 0) return 'Enter settlement rate';
    if (paidNum > agentOpening.totalSarRemaining + 1e-10) {
      return `Paid exceeds agent remaining (${formatFxAmount(agentOpening.totalSarRemaining)} ${currency})`;
    }
    if (!fifoPreview) return 'Check paid amount and settlement rate';
    return null;
  }, [agentLines, toAccountId, paidNum, rateNum, agentOpening, currency, fifoPreview]);

  const selectedPayTo = payToAccounts.find(a => a.id === toAccountId);

  const canSubmit = !!collectionAccountId && !submitBlockReason && fifoPreview != null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !fifoPreview) return;
    setSaving(true);
    try {
      const res = await trackLoading(() =>
        recordAgentFxSettlementAction(
          {
            collectionAccountId,
            toAccountId,
            paidForeign: paidNum,
            settlementRate: rateNum,
            notes: notes.trim() || null,
          },
          branchSlug,
        ),
      );
      if (!res.success) {
        showToast(res.error || 'Settlement failed', 'error');
        return;
      }
      showToast(
        `${collectionAccountName}: ${formatFxAmount(fifoPreview.closing.totalPaidForeign)} ${currency} · Type 2 ${formatFxAmount(fifoPreview.closing.type2ProfitPerLine)} AED`,
      );
      onSuccess();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Close to ${collectionAccountName}`}
      maxWidth="max-w-6xl"
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            form="batch-fx-settlement-form"
            className={btnPrimary}
            disabled={saving || !canSubmit}
            title={submitBlockReason || undefined}
          >
            {saving ? 'Posting…' : 'Post settlement'}
          </button>
        </>
      }
    >
      <form id="batch-fx-settlement-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Agent held ({currency})
            </p>
            <p className="font-mono text-sm font-semibold text-amber-900">
              {formatFxAmount(totalHeld)} {currency}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              AED exposure
            </p>
            <p className="font-mono text-sm font-semibold text-slate-900">
              {formatFxAmount(agentOpening.totalAed)} AED
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Avg sale rate
            </p>
            <p className="font-mono text-sm font-semibold text-slate-900">
              {formatFxAmount(agentOpening.avgSaleRateAed)} AED/u
            </p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
              Avg sale FX
            </p>
            <p className="font-mono text-sm font-semibold text-blue-900">
              {formatFxAmount(agentOpening.avgSaleConversionRate)} {currency}/AED
            </p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Open sales (FIFO — oldest first, all customers)
          </p>
          <div className="overflow-x-auto rounded-lg border border-orange-200/80">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="border-b border-orange-200 bg-orange-50/80 text-[10px] uppercase tracking-wider text-orange-900/80">
                <tr>
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">Sale</th>
                  <th className="px-2 py-2">Customer</th>
                  <th className="px-2 py-2 text-right">Qty</th>
                  <th className="px-2 py-2 text-right">AED/u</th>
                  <th className="px-2 py-2 text-right">AED</th>
                  <th className="px-2 py-2 text-right">Sale FX</th>
                  <th className="px-2 py-2 text-right">Held</th>
                </tr>
              </thead>
              <tbody>
                {agentLines.map((line, index) => {
                  const sale = saleById.get(line.saleId)!;
                  const fifoRow = fifoPreview?.rows.find(r => r.saleId === line.saleId);
                  return (
                    <tr
                      key={line.saleId}
                      className={`border-b border-orange-100/80 ${fifoRow ? 'bg-emerald-50/40' : 'bg-white'}`}
                    >
                      <td className="px-2 py-2 text-slate-400">{index + 1}</td>
                      <td className="px-2 py-2 font-mono">
                        {getFormattedTxnId(sale.id, 'sale', null, branches)}
                      </td>
                      <td className="px-2 py-2">
                        <CustomerProfileLink
                          branchSlug={sale.customerBranchSlug}
                          customerId={sale.orderCustomerId}
                          name={sale.customerName}
                        />
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">{sale.units}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {formatFxAmount(sale.unitRate)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {formatFxAmount(sale.aedAmount || sale.units * sale.unitRate)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold text-blue-800">
                        {formatFxAmount(sale.conversionRate)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-amber-800">
                        {formatFxAmount(sale.foreignRemaining)} {currency}
                        {fifoRow ? (
                          <span className="ml-1 text-emerald-700">
                            → {formatFxAmount(fifoRow.paidForeign)}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {agentLines.length > 0 ? (
                <tfoot className="border-t-2 border-orange-200 bg-orange-50/60 font-semibold">
                  <tr>
                    <td className="px-2 py-2" colSpan={7}>
                      Total held
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-amber-900">
                      {formatFxAmount(agentOpening.totalSarRemaining)} {currency}
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/30 p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-emerald-900">
            Agent remittance ({currency})
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Paid {currency} (full agent receipt)
              <input
                className={`${formInput} mt-1 text-right`}
                type="number"
                step="any"
                min="0"
                placeholder="0"
                value={paidForeign}
                onChange={e => setPaidForeign(e.target.value)}
                required
              />
              <span className="mt-1 block text-[10px] font-normal normal-case text-slate-400">
                Defaults to total held — FIFO allocates across all deals above
              </span>
            </label>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Settlement rate ({currency} per 1 AED)
              <input
                className={`${formInput} mt-1 text-right`}
                type="number"
                step="any"
                min="0"
                placeholder="1.04"
                value={settlementRate}
                onChange={e => setSettlementRate(e.target.value)}
                required
              />
              <span className="mt-1 block text-[10px] font-normal normal-case text-slate-400">
                Agent remittance rate — separate from each sale&apos;s locked Sale FX
              </span>
            </label>
          </div>
          {submitBlockReason ? (
            <p className="mt-3 text-xs text-amber-800">{submitBlockReason}</p>
          ) : null}
        </div>

        <div className="rounded-xl border border-violet-200/80 bg-violet-50/30 p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-violet-900">
            IC Funds remittance (AED cash)
          </p>
          {accountsLoading ? (
            <p className="text-xs text-slate-500">Loading accounts…</p>
          ) : (
            <>
              <AccountPicker
                label="Receive into cash / bank / AED personal *"
                accounts={payToAccounts}
                allowedTypes={remittanceBankTypes}
                value={toAccountId}
                onChange={setToAccountId}
                excludeId={collectionAccountId}
              />
              <p className="mt-2 text-[10px] text-slate-500">
                Contra: debit the till, credit {collectionAccountName}. Customer receivables were
                already cleared at the settlement rate; Type 2 FX difference posts to IC FX Profit.
              </p>
              {fifoPreview && selectedPayTo ? (
                <div className="mt-3 rounded-lg border border-violet-200 bg-white/80 px-3 py-2 text-xs text-violet-950">
                  <span className="font-semibold">{formatFxAmount(fifoPreview.closing.settledAed)} AED</span>
                  {' '}into {selectedPayTo.name} from {collectionAccountName}
                </div>
              ) : null}
            </>
          )}
        </div>

        {fifoPreview ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700">
              Closing summary (FIFO allocation)
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Sale</th>
                    <th className="px-3 py-2 text-right">Sale FX</th>
                    <th className="px-3 py-2 text-right">Paid {currency}</th>
                    <th className="px-3 py-2 text-right">Settle rate</th>
                    <th className="px-3 py-2 text-right">AED @ settle</th>
                    <th className="px-3 py-2 text-right">Type 2</th>
                  </tr>
                </thead>
                <tbody>
                  {fifoPreview.rows.map(row => (
                    <tr key={row.saleId} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-mono">
                        {getFormattedTxnId(row.saleId, 'sale', null, branches)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-blue-800">
                        {formatFxAmount(row.saleConversionRate)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {formatFxAmount(row.paidForeign)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-800">
                        {formatFxAmount(rateNum)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {formatFxAmount(row.settledAed)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-800">
                        {formatFxAmount(row.type2ProfitAed)} AED
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold">
                  <tr>
                    <td className="px-3 py-2" colSpan={2}>
                      Totals
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatFxAmount(fifoPreview.closing.totalPaidForeign)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatFxAmount(fifoPreview.closing.settlementRate)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatFxAmount(fifoPreview.closing.settledAed)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-800">
                      {formatFxAmount(fifoPreview.closing.type2ProfitPerLine)} AED
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2" colSpan={3}>
                      @ avg sale FX {formatFxAmount(fifoPreview.closing.avgSaleConversionRate)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      margin {formatFxAmount(fifoPreview.closing.rateMargin)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatFxAmount(fifoPreview.closing.type2ProfitAtAvgRate)} AED
                    </td>
                    <td className="px-3 py-2 text-right text-[10px] font-normal text-slate-500">
                      ledger uses per-sale FX
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : null}

        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Notes
          <textarea
            className={`${formInput} mt-1 resize-none`}
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </label>
      </form>
    </Modal>
  );
}
