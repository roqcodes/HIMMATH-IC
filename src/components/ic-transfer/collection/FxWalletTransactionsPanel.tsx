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
import type { WalletTransactionRow } from '@/app/actions/icWalletActions';
import CustomerProfileLink from '@/components/customers/CustomerProfileLink';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import { HQ_IC_FUNDS_BRANCH_SLUG } from '@/lib/icFunds/hqBranch';
import { formatFxAmount } from '@/lib/icTransfer/saleFxProfit';
import { formatDateTime } from '@/lib/format';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';
type TypeFilter = 'all' | 'customer_payment' | 'agent_transfer';

function StatusBadge({ status }: { status: WalletTransactionRow['status'] }) {
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

function TypeBadge({ type }: { type: WalletTransactionRow['transactionType'] }) {
  const label = type === 'customer_payment' ? 'Customer payment' : 'Agent transfer';
  return (
    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
      {label}
    </span>
  );
}

type Props = {
  transactions: WalletTransactionRow[];
  loading?: boolean;
  accountsSlug?: string;
};

export default function FxWalletTransactionsPanel({
  transactions,
  loading,
  accountsSlug = HQ_IC_FUNDS_BRANCH_SLUG,
}: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter(tx => {
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
      if (typeFilter !== 'all' && tx.transactionType !== typeFilter) return false;
      if (!q) return true;
      return (
        tx.transactionLabel.toLowerCase().includes(q) ||
        (tx.customerName || '').toLowerCase().includes(q) ||
        (tx.fromAccountName || '').toLowerCase().includes(q) ||
        (tx.toAccountName || '').toLowerCase().includes(q) ||
        (tx.notes || '').toLowerCase().includes(q)
      );
    });
  }, [search, statusFilter, transactions, typeFilter]);

  return (
    <div className="flex min-h-[320px] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search transaction, customer, agent…"
          className={`${asicInput} min-w-[180px] flex-1`}
        />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as TypeFilter)}
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
        >
          <option value="all">All types</option>
          <option value="customer_payment">Customer payments</option>
          <option value="agent_transfer">Agent transfers</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
        >
          <option value="all">All statuses</option>
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
              <th className={asicTh}>Type</th>
              <th className={asicTh}>Customer / route</th>
              <th className={`${asicTh} text-right`}>Amount</th>
              <th className={asicTh}>Status</th>
              <th className={asicTh}>Submitted</th>
              <th className={`${asicTh} text-right`}>Allocations</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-sm text-slate-500">
                  Loading wallet transactions…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-sm text-slate-500">
                  {transactions.length === 0
                    ? 'No wallet transactions recorded yet.'
                    : 'No transactions match your filters.'}
                </td>
              </tr>
            ) : (
              filtered.map(tx => (
                <tr key={tx.id} className={asicTr}>
                  <td className={`${asicTd} font-mono text-xs font-medium text-slate-900`}>
                    {tx.transactionLabel}
                  </td>
                  <td className={asicTd}>
                    <TypeBadge type={tx.transactionType} />
                  </td>
                  <td className={asicTd}>
                    {tx.transactionType === 'customer_payment' ? (
                      <div>
                        <p className="font-medium text-slate-900">
                          <CustomerProfileLink
                            branchSlug={tx.customerBranchSlug}
                            customerId={tx.customerId}
                            name={tx.customerName || 'Customer'}
                          />
                        </p>
                        <p className="text-[11px] text-slate-500">
                          <ICFundAccountLink
                            slug={accountsSlug}
                            accountId={tx.fromAccountId}
                            name={tx.fromAccountName || 'Customer wallet'}
                          />
                          {' → '}
                          <ICFundAccountLink
                            slug={accountsSlug}
                            accountId={tx.toAccountId}
                            name={tx.toAccountName || 'Agent'}
                          />
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-600">
                        <ICFundAccountLink
                          slug={accountsSlug}
                          accountId={tx.fromAccountId}
                          name={tx.fromAccountName || 'Agent'}
                        />
                        {' → '}
                        <ICFundAccountLink
                          slug={accountsSlug}
                          accountId={tx.toAccountId}
                          name={tx.toAccountName || 'Agent'}
                        />
                      </p>
                    )}
                    {tx.enteredByName ? (
                      <p className="text-[10px] text-slate-400">By {tx.enteredByName}</p>
                    ) : null}
                  </td>
                  <td className={`${asicTd} text-right tabular-nums font-medium`}>
                    {formatFxAmount(tx.amount)} {tx.currency}
                  </td>
                  <td className={asicTd}>
                    <div className="space-y-0.5">
                      <StatusBadge status={tx.status} />
                      {tx.status === 'rejected' && tx.rejectionReason ? (
                        <p className="text-[10px] text-rose-600">{tx.rejectionReason}</p>
                      ) : null}
                    </div>
                  </td>
                  <td className={`${asicTd} text-xs text-slate-500`}>
                    {tx.createdAt ? formatDateTime(tx.createdAt) : '—'}
                  </td>
                  <td className={`${asicTd} text-right tabular-nums text-xs text-slate-600`}>
                    {tx.allocationCount > 0 ? tx.allocationCount : '—'}
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
