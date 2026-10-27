'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { btnPrimary, btnSecondary, formInput } from '@/lib/ui';
import { useApp } from '@/context/AppContext';
import {
  approveFxSettlementRequestAction,
  listFxSettlementPayToAccountsAction,
  listOpenForeignSalesByAgentAction,
  rejectFxSettlementRequestAction,
} from '@/app/actions/saleFxSettlementActions';
import AccountPicker from '@/components/ic-funds/AccountPicker';
import { FX_REMITTANCE_RECEIVE_TYPES } from '@/lib/icFunds/voucherRules';
import {
  buildFifoAllocations,
  computeAgentGroupClosingSummary,
  computeSaleFxSettlementAmounts,
  formatFxAmount,
  sortSalesFifo,
  type FxOpenSaleLine,
} from '@/lib/icTransfer/saleFxProfit';
import { getFormattedTxnId } from '@/lib/icTransferMappers';
import { trackLoading } from '@/lib/loadingBar';
import type { ICFundAccount, ICFundAccountType } from '@/types';
import type { PendingFxRequest } from './PendingFxSettlementRequestsPanel';
import type { AgentGroupSale } from './BatchFxSettlementModal';

type Props = {
  open: boolean;
  request: PendingFxRequest;
  branchSlug?: string;
  onClose: () => void;
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

export default function ApproveFxSettlementRequestModal({
  open,
  request,
  branchSlug,
  onClose,
  onSuccess,
}: Props) {
  const { showToast, branches } = useApp();
  const [sales, setSales] = useState<AgentGroupSale[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);
  const [settlementRate, setSettlementRate] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [payToAccounts, setPayToAccounts] = useState<ICFundAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const remittanceBankTypes = useMemo(() => FX_REMITTANCE_RECEIVE_TYPES, []);

  useEffect(() => {
    if (!open) return;
    setSettlementRate('');
    setToAccountId('');
    setNotes('');
    setLoadingSales(true);
    void listOpenForeignSalesByAgentAction(branchSlug).then(res => {
      if (!res.success || !res.groups) {
        setSales([]);
      } else {
        const group = res.groups.find(g => g.collectionAccountId === request.collectionAccountId);
        setSales((group?.sales as AgentGroupSale[]) || []);
      }
      setLoadingSales(false);
    });
  }, [open, request.collectionAccountId, branchSlug]);

  useEffect(() => {
    if (!open) return;
    setAccountsLoading(true);
    void listFxSettlementPayToAccountsAction(branchSlug).then(res => {
      if (!res.success) {
        showToast(res.error || 'Failed to load accounts', 'error');
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

  const agentLines = useMemo(
    () => sortSalesFifo(sales.filter(s => s.foreignRemaining > 1e-10).map(toOpenLine)),
    [sales],
  );

  const rateNum = parseFloat(settlementRate);
  const paidNum = request.paidForeign;

  const fifoPreview = useMemo(() => {
    if (
      agentLines.length === 0 ||
      !Number.isFinite(rateNum) ||
      rateNum <= 0 ||
      paidNum <= 0
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
          settledAed: line.settledAed,
          type2ProfitAed: line.type2ProfitAed,
        };
      });
      return { closing, rows };
    } catch {
      return null;
    }
  }, [agentLines, paidNum, rateNum]);

  const submitBlockReason = useMemo(() => {
    if (loadingSales) return 'Loading open deals…';
    if (agentLines.length === 0) return 'No open balance on this agent';
    if (!toAccountId) return 'Select paid-to account';
    if (!Number.isFinite(rateNum) || rateNum <= 0) return 'Enter settlement rate';
    if (!fifoPreview) return 'Check settlement rate';
    return null;
  }, [loadingSales, agentLines, toAccountId, rateNum, fifoPreview]);

  const handleApprove = async () => {
    if (submitBlockReason || !fifoPreview) return;
    setSaving(true);
    try {
      const res = await trackLoading(() =>
        approveFxSettlementRequestAction(
          {
            requestId: request.id,
            settlementRate: rateNum,
            toAccountId,
            notes: notes.trim() || null,
          },
          branchSlug,
        ),
      );
      if (!res.success) {
        showToast(res.error || 'Approval failed', 'error');
        return;
      }
      showToast(
        `Approved · ${formatFxAmount(fifoPreview.closing.totalPaidForeign)} ${request.currency} · Type 2 ${formatFxAmount(fifoPreview.closing.type2ProfitPerLine)} AED`,
      );
      onSuccess();
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    setSaving(true);
    try {
      const res = await trackLoading(() =>
        rejectFxSettlementRequestAction({ requestId: request.id }, branchSlug),
      );
      if (!res.success) {
        showToast(res.error || 'Reject failed', 'error');
        return;
      }
      showToast('Remittance request rejected');
      onSuccess();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Approve remittance · ${request.collectionAccountName || 'Agent'}`}
      maxWidth="max-w-5xl"
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={btnSecondary} onClick={() => void handleReject()} disabled={saving}>
            Reject
          </button>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => void handleApprove()}
            disabled={saving || !!submitBlockReason}
            title={submitBlockReason || undefined}
          >
            {saving ? 'Posting…' : 'Approve & settle'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-violet-200 bg-violet-50/40 px-3 py-2 text-sm">
          Agent submitted{' '}
          <span className="font-mono font-semibold">
            {formatFxAmount(request.paidForeign)} {request.currency}
          </span>
          {request.agentNotes ? (
            <p className="mt-1 text-xs text-slate-600">{request.agentNotes}</p>
          ) : null}
        </div>

        {loadingSales ? (
          <p className="text-sm text-slate-500">Loading open deals…</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-2 py-2">Sale</th>
                  <th className="px-2 py-2">Customer</th>
                  <th className="px-2 py-2 text-right">Held</th>
                  <th className="px-2 py-2 text-right">Sale FX</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(sale => (
                  <tr key={sale.id} className="border-b border-slate-100">
                    <td className="px-2 py-2 font-mono">
                      {getFormattedTxnId(sale.id, 'sale', null, branches)}
                    </td>
                    <td className="px-2 py-2">{sale.customerName}</td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-amber-800">
                      {formatFxAmount(sale.foreignRemaining)} {request.currency}
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums">
                      {formatFxAmount(sale.conversionRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Settlement rate ({request.currency} per 1 AED) *
            <input
              className={`${formInput} mt-1 text-right`}
              type="number"
              step="any"
              min="0"
              value={settlementRate}
              onChange={e => setSettlementRate(e.target.value)}
              required
            />
          </label>
          <div>
            {accountsLoading ? (
              <p className="text-xs text-slate-500">Loading accounts…</p>
            ) : (
              <AccountPicker
                label="Receive into cash / bank / AED personal *"
                accounts={payToAccounts}
                allowedTypes={remittanceBankTypes}
                value={toAccountId}
                onChange={setToAccountId}
                excludeId={request.collectionAccountId}
              />
            )}
          </div>
        </div>

        {fifoPreview ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-xs">
            <p>
              Settles{' '}
              <span className="font-semibold">
                {formatFxAmount(fifoPreview.closing.settledAed)} AED
              </span>
              {' · Type 2 profit '}
              <span className="font-semibold text-emerald-800">
                {formatFxAmount(fifoPreview.closing.type2ProfitPerLine)} AED
              </span>
            </p>
          </div>
        ) : null}

        {submitBlockReason ? (
          <p className="text-xs text-amber-800">{submitBlockReason}</p>
        ) : null}

        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Admin notes
          <textarea
            className={`${formInput} mt-1 resize-none`}
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </label>
      </div>
    </Modal>
  );
}
