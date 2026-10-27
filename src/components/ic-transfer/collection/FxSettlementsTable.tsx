'use client';

import React from 'react';
import {
  asicInput,
  asicTable,
  asicTableWrap,
  asicTd,
  asicTh,
  asicTheadRow,
  asicTr,
} from '@/components/asic/ui';
import CustomerProfileLink from '@/components/customers/CustomerProfileLink';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import { HQ_IC_FUNDS_BRANCH_SLUG } from '@/lib/icFunds/hqBranch';
import { formatFxAmount } from '@/lib/icTransfer/saleFxProfit';

export type FxSettlementRow = {
  id: string;
  saleId: string;
  collectionAccountId?: string;
  currency: string;
  paidForeign: number;
  settlementRate: number;
  type2ProfitAed: number;
  settledAt?: string;
  collectionAccountName?: string;
  customerName: string;
  customerId?: string;
  customerBranchSlug?: string;
};

type Props = {
  rows: FxSettlementRow[];
  loading?: boolean;
  total: number;
  totalType2: number;
  offset: number;
  pageSize: number;
  accountsSlug?: string;
  onPrev: () => void;
  onNext: () => void;
};

export default function FxSettlementsTable({
  rows,
  loading,
  total,
  totalType2,
  offset,
  pageSize,
  accountsSlug = HQ_IC_FUNDS_BRANCH_SLUG,
  onPrev,
  onNext,
}: Props) {
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + pageSize, total);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.floor(offset / pageSize) + 1;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
        <h3 className="text-sm font-semibold text-slate-900">Recent settlements</h3>
        <p className="text-xs text-slate-500">
          Total Type 2 booked{' '}
          <span className="font-mono font-semibold text-slate-800">{formatFxAmount(totalType2)} AED</span>
          {total > 0 ? (
            <span className="ml-2">
              · {pageStart}–{pageEnd} of {total}
            </span>
          ) : null}
        </p>
      </div>
      <div className={asicTableWrap}>
        <table className={asicTable}>
          <thead>
            <tr className={asicTheadRow}>
              <th className={asicTh}>Date</th>
              <th className={asicTh}>Customer</th>
              <th className={asicTh}>Agent</th>
              <th className={`${asicTh} text-right`}>Paid</th>
              <th className={`${asicTh} text-right`}>Settle rate</th>
              <th className={`${asicTh} text-right`}>Type 2 AED</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-500">
                  Loading settlements…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-500">
                  No settlements recorded yet.
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr key={row.id} className={asicTr}>
                  <td className={`${asicTd} text-slate-600`}>
                    {row.settledAt ? new Date(row.settledAt).toLocaleDateString() : '—'}
                  </td>
                  <td className={asicTd}>
                    <CustomerProfileLink
                      branchSlug={row.customerBranchSlug}
                      customerId={row.customerId}
                      name={row.customerName || '—'}
                    />
                  </td>
                  <td className={asicTd}>
                    {row.collectionAccountId ? (
                      <ICFundAccountLink
                        slug={accountsSlug}
                        accountId={row.collectionAccountId}
                        name={row.collectionAccountName || '—'}
                      />
                    ) : (
                      row.collectionAccountName || '—'
                    )}
                  </td>
                  <td className={`${asicTd} text-right tabular-nums`}>
                    {formatFxAmount(row.paidForeign)} {row.currency}
                  </td>
                  <td className={`${asicTd} text-right tabular-nums`}>
                    {formatFxAmount(row.settlementRate)}
                  </td>
                  <td
                    className={`${asicTd} text-right tabular-nums font-medium ${
                      row.type2ProfitAed < 0 ? 'text-red-600' : 'text-emerald-700'
                    }`}
                  >
                    {formatFxAmount(row.type2ProfitAed)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {total > pageSize ? (
        <div className="flex items-center gap-2 border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
          <button
            type="button"
            className={`${asicInput} !h-7 w-auto`}
            disabled={loading || offset === 0}
            onClick={onPrev}
          >
            Prev
          </button>
          <span>
            Page {currentPage} of {pageCount}
          </span>
          <button
            type="button"
            className={`${asicInput} !h-7 w-auto`}
            disabled={loading || offset + pageSize >= total}
            onClick={onNext}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
