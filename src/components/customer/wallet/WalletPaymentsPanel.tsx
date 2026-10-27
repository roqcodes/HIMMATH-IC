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
import type { CustomerWalletPaymentRow } from '@/app/actions/icWalletActions';
import { formatFxAmount } from '@/lib/icTransfer/saleFxProfit';
import { formatDateTime } from '@/lib/format';

type PaymentFilter = 'all' | 'pending' | 'approved' | 'rejected';

function PaymentStatusBadge({ status }: { status: CustomerWalletPaymentRow['status'] }) {
  const map = {
    pending: { label: 'Pending', className: 'border-amber-200 bg-amber-50 text-amber-800' },
    approved: { label: 'Approved', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    rejected: { label: 'Rejected', className: 'border-rose-200 bg-rose-50 text-rose-700' },
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
  payments: CustomerWalletPaymentRow[];
  loading?: boolean;
};

export default function WalletPaymentsPanel({ payments, loading }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PaymentFilter>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter(payment => {
      if (filter !== 'all' && payment.status !== filter) return false;
      if (!q) return true;
      return (
        payment.transactionLabel.toLowerCase().includes(q) ||
        payment.agentName.toLowerCase().includes(q) ||
        (payment.notes || '').toLowerCase().includes(q) ||
        payment.currency.toLowerCase().includes(q)
      );
    });
  }, [filter, payments, search]);

  return (
    <div className="flex min-h-[280px] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search agent or notes…"
          className={`${asicInput} min-w-[180px] flex-1`}
        />
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as PaymentFilter)}
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
        >
          <option value="all">All payments</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className={asicTableWrap}>
        <table className={asicTable}>
          <thead>
            <tr className={asicTheadRow}>
              <th className={asicTh}>Transaction</th>
              <th className={asicTh}>Submitted</th>
              <th className={asicTh}>Agent</th>
              <th className={`${asicTh} text-right`}>Amount</th>
              <th className={asicTh}>Status</th>
              <th className={asicTh}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-400">
                  Loading payments…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-400">
                  {payments.length === 0 ? 'No wallet payments recorded yet.' : 'No payments match your filters.'}
                </td>
              </tr>
            ) : (
              filtered.map(payment => (
                <tr key={payment.id} className={asicTr}>
                  <td className={`${asicTd} font-mono text-xs font-medium text-slate-900`}>
                    {payment.transactionLabel}
                  </td>
                  <td className={`${asicTd} text-xs text-slate-500`}>
                    {payment.createdAt ? formatDateTime(payment.createdAt) : '—'}
                  </td>
                  <td className={asicTd}>{payment.agentName}</td>
                  <td className={`${asicTd} text-right tabular-nums font-medium`}>
                    {formatFxAmount(payment.amount)} {payment.currency}
                  </td>
                  <td className={asicTd}>
                    <div className="space-y-0.5">
                      <PaymentStatusBadge status={payment.status} />
                      {payment.status === 'rejected' && payment.rejectionReason ? (
                        <p className="text-[10px] text-rose-600" title={payment.rejectionReason}>
                          {payment.rejectionReason}
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className={`${asicTd} max-w-[200px] truncate text-xs text-slate-500`} title={payment.notes}>
                    {payment.notes || '—'}
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
