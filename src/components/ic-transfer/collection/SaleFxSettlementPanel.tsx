'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  getSaleFxSettlementSummaryAction,
  listSaleFxSettlementsAction,
} from '@/app/actions/saleFxSettlementActions';
import CustomerProfileLink from '@/components/customers/CustomerProfileLink';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import { HQ_IC_FUNDS_BRANCH_SLUG } from '@/lib/icFunds/hqBranch';
import type { ICSale, ICSaleFxSettlement } from '@/types';
import { isForeignCurrencySale, formatFxAmount } from '@/lib/icTransfer/saleFxProfit';

type Props = {
  sale: ICSale;
};

export default function SaleFxSettlementPanel({ sale }: Props) {
  const { currentSlug } = useApp();
  const branchSlug = currentSlug !== 'superadmin' ? currentSlug : undefined;
  const [summary, setSummary] = useState<{
    currency?: string;
    conversionRate?: number;
    convertedAmount: number;
    foreignCollected: number;
    foreignRemaining: number;
    totalType2Profit: number;
    paymentStatus: string;
    isForeign: boolean;
  } | null>(null);
  const [rows, setRows] = useState<ICSaleFxSettlement[]>([]);

  const isForeign = isForeignCurrencySale(sale.currency, sale.conversionRate);

  const load = async () => {
    const [sumRes, listRes] = await Promise.all([
      getSaleFxSettlementSummaryAction(sale.id),
      listSaleFxSettlementsAction(sale.id, branchSlug),
    ]);
    if (sumRes.success && sumRes.summary) setSummary(sumRes.summary);
    if (listRes.success && listRes.settlements) setRows(listRes.settlements);
  };

  useEffect(() => {
    if (!isForeign || sale.orderStatus !== 'completed') return;
    void load();
  }, [sale.id, sale.orderStatus, isForeign]);

  if (!isForeign || sale.orderStatus !== 'completed') return null;

  return (
    <section className="rounded-lg border border-[var(--theme-border-subtle)] bg-white p-3 shadow-surface-xs dark:bg-[var(--theme-surface)]">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-900">FX collection (Type 2)</h3>
        <p className="text-[11px] text-slate-500">
          Sale locked {formatFxAmount(Number(sale.conversionRate))} {sale.currency} / AED · owed{' '}
          {formatFxAmount(Number(sale.convertedAmount || 0))} {sale.currency}. Customers pay assigned
          collection agents; settle agent balance on the FX page.
        </p>
      </div>

      {summary ? (
        <div className="mb-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-slate-500">Paid to agent</p>
            <p className="font-mono font-semibold">
              {formatFxAmount(summary.foreignCollected)} {summary.currency}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-slate-500">Remaining</p>
            <p className="font-mono font-semibold text-amber-700">
              {formatFxAmount(summary.foreignRemaining)} {summary.currency}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-slate-500">Type 2 total</p>
            <p className="font-mono font-semibold text-emerald-700">
              {formatFxAmount(summary.totalType2Profit)} AED
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-slate-500">Payment</p>
            <p className="font-semibold capitalize">{summary.paymentStatus}</p>
          </div>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                <th className="py-1 pr-2">Date</th>
                <th className="py-1 pr-2">Agent</th>
                <th className="py-1 pr-2 text-right">Settled</th>
                <th className="py-1 pr-2 text-right">Rate</th>
                <th className="py-1 text-right">Type 2</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-slate-50">
                  <td className="py-1.5 pr-2 text-slate-600">
                    {row.settledAt ? new Date(row.settledAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-1.5 pr-2">
                    {row.collectionAccountId ? (
                      <ICFundAccountLink
                        slug={HQ_IC_FUNDS_BRANCH_SLUG}
                        accountId={row.collectionAccountId}
                        name={row.collectionAccountName || '—'}
                      />
                    ) : (
                      row.collectionAccountName || '—'
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono">
                    {formatFxAmount(row.paidForeign)} {row.currency}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono">
                    {formatFxAmount(row.settlementRate)}
                  </td>
                  <td
                    className={`py-1.5 text-right font-mono font-semibold ${
                      row.type2ProfitAed < 0 ? 'text-red-600' : 'text-emerald-700'
                    }`}
                  >
                    {formatFxAmount(row.type2ProfitAed)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-slate-500">No AED settlements recorded for this sale yet.</p>
      )}
    </section>
  );
}
