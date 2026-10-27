'use client';

import React, { useMemo, useState } from 'react';
import {
  asicInput,
  asicTable,
  asicTableWrap,
  asicTd,
  asicTh,
  asicTheadRow,
  asicTr,
} from '@/components/asic/ui';
import type { CustomerWalletSaleRow } from '@/app/actions/icWalletActions';
import { formatFxAmount } from '@/lib/icTransfer/saleFxProfit';
import { formatDate } from '@/lib/format';
import { getFormattedTxnId } from '@/lib/icTransferMappers';
import type { Branch } from '@/types';

type SaleFilter = 'all' | 'open' | 'paid';

function PaymentStatusBadge({ status }: { status: CustomerWalletSaleRow['paymentStatus'] }) {
  const map = {
    pending: { label: 'Unpaid', className: 'border-rose-200 bg-rose-50 text-rose-700' },
    partial: { label: 'Partial', className: 'border-amber-200 bg-amber-50 text-amber-800' },
    paid: { label: 'Paid', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  } as const;
  const tone = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone.className}`}
    >
      {tone.label}
    </span>
  );
}

type Props = {
  sales: CustomerWalletSaleRow[];
  currency: string;
  branches: Branch[];
  loading?: boolean;
};

export default function WalletSalesPanel({ sales, currency, branches, loading }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SaleFilter>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter(sale => {
      if (filter === 'open' && sale.foreignRemaining <= 1e-10) return false;
      if (filter === 'paid' && sale.paymentStatus !== 'paid') return false;
      if (!q) return true;
      const saleLabel = getFormattedTxnId(sale.saleId, 'sale', null, branches).toLowerCase();
      return saleLabel.includes(q) || sale.currency.toLowerCase().includes(q);
    });
  }, [branches, filter, sales, search]);

  return (
    <div className="flex min-h-[280px] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search sale…"
          className={`${asicInput} min-w-[180px] flex-1`}
        />
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as SaleFilter)}
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
        >
          <option value="all">All sales</option>
          <option value="open">Open balance</option>
          <option value="paid">Fully paid</option>
        </select>
      </div>

      <div className={asicTableWrap}>
        <table className={asicTable}>
          <thead>
            <tr className={asicTheadRow}>
              <th className={asicTh}>Sale</th>
              <th className={asicTh}>Date</th>
              <th className={`${asicTh} text-right`}>AED</th>
              <th className={`${asicTh} text-right`}>Foreign owed</th>
              <th className={`${asicTh} text-right`}>Paid</th>
              <th className={`${asicTh} text-right`}>Remaining</th>
              <th className={asicTh}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">
                  Loading sales…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">
                  {sales.length === 0 ? 'No foreign-currency sales yet.' : 'No sales match your filters.'}
                </td>
              </tr>
            ) : (
              filtered.map(sale => (
                <tr key={sale.saleId} className={asicTr}>
                  <td className={`${asicTd} font-mono text-xs`}>
                    {getFormattedTxnId(sale.saleId, 'sale', null, branches)}
                  </td>
                  <td className={`${asicTd} text-xs text-slate-500`}>
                    {sale.createdAt ? formatDate(sale.createdAt) : '—'}
                  </td>
                  <td className={`${asicTd} text-right tabular-nums text-xs text-slate-600`}>
                    {formatFxAmount(sale.aedAmount)} AED
                  </td>
                  <td className={`${asicTd} text-right tabular-nums`}>
                    {formatFxAmount(sale.convertedAmount)} {sale.currency || currency}
                  </td>
                  <td className={`${asicTd} text-right tabular-nums text-indigo-700`}>
                    {formatFxAmount(sale.foreignPaid)} {sale.currency || currency}
                  </td>
                  <td className={`${asicTd} text-right tabular-nums text-amber-700`}>
                    {formatFxAmount(sale.foreignRemaining)} {sale.currency || currency}
                  </td>
                  <td className={asicTd}>
                    <PaymentStatusBadge status={sale.paymentStatus} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
