'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  getCollectionAgentFxDashboardAction,
  submitFxSettlementRequestAction,
} from '@/app/actions/saleFxSettlementActions';
import { asicCard, asicTable, asicTableWrap, asicTd, asicTh, asicTheadRow, asicTr, asicBtnPrimary } from '@/components/asic/ui';
import { btnPrimary, formInput } from '@/lib/ui';
import { formatFxAmount } from '@/lib/icTransfer/saleFxProfit';
import { getFormattedTxnId } from '@/lib/icTransferMappers';
import { trackLoading, maybeTrackLoading } from '@/lib/loadingBar';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import { usePageRefresh } from '@/hooks/usePageRefresh';

type AgentSale = {
  id: string;
  customerName: string;
  units: number;
  unitRate: number;
  aedAmount: number;
  conversionRate: number;
  foreignRemaining: number;
  createdAt?: string;
};

type RemittanceRequest = {
  id: string;
  paidForeign: number;
  currency: string;
  settlementRate?: number;
  settledAed?: number;
  status: 'pending' | 'approved' | 'rejected';
  agentNotes?: string;
  rejectionReason?: string;
  reviewedAt?: string;
  createdAt?: string;
};

export default function CollectionAgentFxPage() {
  const { showToast, branches, currentSlug } = useApp();
  const branchSlug = currentSlug !== 'superadmin' ? currentSlug : undefined;

  const [loading, setLoading] = useState(true);
  const [agentName, setAgentName] = useState('');
  const [currency, setCurrency] = useState('');
  const [agentBalance, setAgentBalance] = useState(0);
  const [closing, setClosing] = useState<{
    totalSarRemaining: number;
    avgSaleRateAed: number;
    avgSaleConversionRate: number;
    totalAed: number;
  } | null>(null);
  const [sales, setSales] = useState<AgentSale[]>([]);
  const [requests, setRequests] = useState<RemittanceRequest[]>([]);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [paidForeign, setPaidForeign] = useState('');
  const [agentNotes, setAgentNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent = false) => {
    setLoading(true);
    const res = await maybeTrackLoading(() => getCollectionAgentFxDashboardAction(branchSlug), !silent);
    if (!res.success) {
      showToast(res.error || 'Failed to load remittance dashboard', 'error');
      setLoading(false);
      return;
    }
    setAgentName(res.agent.name);
    setCurrency(res.agent.currency);
    setAgentBalance(res.agent.agentBalance);
    setClosing(res.agent.closing);
    setSales(res.sales);
    setRequests(res.requests);
    setPendingRequestCount(res.pendingRequestCount);
    if (res.pendingRequestCount === 0) {
      setPaidForeign(
        res.agent.agentBalance > 0 ? formatFxAmount(res.agent.agentBalance) : '',
      );
    }
    setLoading(false);
  }, [branchSlug, showToast]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    void load();
  }, [load]);

  const paidNum = parseFloat(paidForeign);
  const canSubmit = useMemo(() => {
    if (pendingRequestCount > 0) return false;
    if (!Number.isFinite(paidNum) || paidNum <= 0) return false;
    if (paidNum > agentBalance + 1e-10) return false;
    return true;
  }, [pendingRequestCount, paidNum, agentBalance]);

  const submitBlockReason = useMemo(() => {
    if (pendingRequestCount > 0) return 'You already have a pending remittance request';
    if (!Number.isFinite(paidNum) || paidNum <= 0) return 'Enter remittance amount';
    if (paidNum > agentBalance + 1e-10) {
      return `Amount exceeds held balance (${formatFxAmount(agentBalance)} ${currency})`;
    }
    return null;
  }, [pendingRequestCount, paidNum, agentBalance, currency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      const res = await trackLoading(() =>
        submitFxSettlementRequestAction(
          { paidForeign: paidNum, agentNotes: agentNotes.trim() || null },
          branchSlug,
        ),
      );
      if (!res.success) {
        showToast(res.error || 'Failed to submit request', 'error');
        return;
      }
      showToast('Remittance request submitted for admin approval');
      setAgentNotes('');
      void load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`${asicCard} px-4 py-10 text-center text-sm text-slate-500`}>
        Loading remittance dashboard…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{agentName}</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Submit {currency} remittance for admin approval. Settlement rate and AED ledger posting are handled by admin.
        </p>
      </div>

      <AsicKpiStrip
        metrics={[
          {
            label: 'Held balance',
            value: `${formatFxAmount(agentBalance)} ${currency}`,
            hint: 'Approved customer payments on your account',
            tone: agentBalance > 0 ? 'amber' : 'slate',
          },
          {
            label: 'AED exposure',
            value: closing ? `${formatFxAmount(closing.totalAed)} AED` : '—',
            hint: 'At locked sale FX rates',
            tone: 'default',
          },
          {
            label: 'Open deals',
            value: sales.length.toLocaleString(),
            hint: 'Sales with unsettled balance',
            tone: 'indigo',
          },
          {
            label: 'Pending request',
            value: pendingRequestCount > 0 ? 'Yes' : 'None',
            hint: pendingRequestCount > 0 ? 'Awaiting admin FX rate' : 'Ready to submit',
            tone: pendingRequestCount > 0 ? 'amber' : 'emerald',
          },
        ]}
      />

      <section className={asicCard}>
        <div className="border-b border-slate-200 px-3 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Open deals</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Foreign balance held per sale (oldest first at settlement).
          </p>
        </div>
        {sales.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">No unsettled balance.</p>
        ) : (
          <div className={asicTableWrap}>
            <table className={asicTable}>
              <thead>
                <tr className={asicTheadRow}>
                  <th className={asicTh}>Sale</th>
                  <th className={asicTh}>Customer</th>
                  <th className={`${asicTh} text-right`}>Qty</th>
                  <th className={`${asicTh} text-right`}>AED/u</th>
                  <th className={`${asicTh} text-right`}>Sale FX</th>
                  <th className={`${asicTh} text-right`}>Held</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(sale => (
                  <tr key={sale.id} className={asicTr}>
                    <td className={`${asicTd} font-mono text-xs`}>
                      {getFormattedTxnId(sale.id, 'sale', null, branches)}
                    </td>
                    <td className={asicTd}>{sale.customerName}</td>
                    <td className={`${asicTd} text-right tabular-nums`}>{sale.units}</td>
                    <td className={`${asicTd} text-right tabular-nums`}>
                      {formatFxAmount(sale.unitRate)}
                    </td>
                    <td className={`${asicTd} text-right tabular-nums`}>
                      {formatFxAmount(sale.conversionRate)}
                    </td>
                    <td className={`${asicTd} text-right tabular-nums font-medium text-amber-700`}>
                      {formatFxAmount(sale.foreignRemaining)} {currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={`${asicCard} border-emerald-200/80 bg-emerald-50/20`}>
        <div className="border-b border-emerald-100 px-3 py-3">
          <h2 className="text-sm font-semibold text-emerald-950">Submit remittance</h2>
          <p className="mt-0.5 text-[11px] text-emerald-900/70">
            Enter the {currency} amount you remitted. Admin will set the FX rate and approve settlement.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-3 py-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Remittance amount ({currency}) *
            <input
              className={`${formInput} mt-1 text-right`}
              type="number"
              step="any"
              min="0"
              value={paidForeign}
              onChange={e => setPaidForeign(e.target.value)}
              disabled={pendingRequestCount > 0 || saving}
              required
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Notes
            <textarea
              className={`${formInput} mt-1 resize-none`}
              rows={2}
              value={agentNotes}
              onChange={e => setAgentNotes(e.target.value)}
              disabled={pendingRequestCount > 0 || saving}
              placeholder="Optional reference for admin"
            />
          </label>
          {submitBlockReason ? (
            <p className="text-xs text-amber-800">{submitBlockReason}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="submit"
              className={asicBtnPrimary}
              disabled={!canSubmit || saving || pendingRequestCount > 0}
            >
              {saving ? 'Submitting…' : 'Submit for approval'}
            </button>
          </div>
        </form>
      </section>

      <section className={asicCard}>
        <div className="border-b border-slate-200 px-3 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Request history</h2>
        </div>
        {requests.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">No remittance requests yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map(req => (
              <div key={req.id} className="px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">
                    {formatFxAmount(req.paidForeign)} {req.currency}
                    {req.status === 'approved' && req.settledAed != null ? (
                      <span className="ml-2 text-slate-600">
                        → {formatFxAmount(req.settledAed)} AED
                      </span>
                    ) : null}
                  </p>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      req.status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : req.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {req.createdAt ? new Date(req.createdAt).toLocaleString() : ''}
                  {req.status === 'approved' && req.settlementRate
                    ? ` · Rate ${formatFxAmount(req.settlementRate)} ${req.currency}/AED`
                    : ''}
                  {req.status === 'rejected' && req.rejectionReason
                    ? ` · ${req.rejectionReason}`
                    : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
