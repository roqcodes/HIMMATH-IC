'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { asicBtnOutline, asicBtnPrimary, asicCard } from '@/components/asic/ui';
import CustomerProfileLink from '@/components/customers/CustomerProfileLink';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import { useApp } from '@/context/AppContext';
import {
  approveWalletTransactionAction,
  listPendingWalletTransactionsAction,
} from '@/app/actions/icWalletActions';
import { HQ_IC_FUNDS_BRANCH_SLUG } from '@/lib/icFunds/hqBranch';
import { formatFxAmount } from '@/lib/icTransfer/saleFxProfit';
import { trackLoading } from '@/lib/loadingBar';

type Props = {
  branchSlug?: string;
  accountsSlug?: string;
  onChanged?: () => void;
};

export default function PendingWalletApprovalsPanel({
  branchSlug,
  accountsSlug = HQ_IC_FUNDS_BRANCH_SLUG,
  onChanged,
}: Props) {
  const { showToast } = useApp();
  const [rows, setRows] = useState<
    Array<{
      id: string;
      transactionLabel: string;
      customerId?: string;
      customerBranchSlug?: string;
      customerName?: string;
      collectionAccountId: string;
      collectionAccountName: string;
      amount: number;
      currency: string;
      enteredByName?: string;
      createdAt?: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listPendingWalletTransactionsAction(branchSlug);
    if (res.success && res.transactions) setRows(res.transactions);
    else setRows([]);
    setLoading(false);
  }, [branchSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, approve: boolean) => {
    setActingId(id);
    try {
      const res = await trackLoading(() =>
        approveWalletTransactionAction({ transactionId: id, approve }, branchSlug),
      );
      if (!res.success) {
        showToast(res.error || 'Action failed', 'error');
        return;
      }
      showToast(approve ? 'Payment approved' : 'Payment rejected');
      void load();
      onChanged?.();
    } finally {
      setActingId(null);
    }
  };

  if (loading || rows.length === 0) return null;

  return (
    <section className={`${asicCard} border-amber-200 bg-amber-50/30`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 px-3 py-2.5">
        <div>
          <h2 className="text-sm font-semibold text-amber-950">Pending wallet payments</h2>
          <p className="text-[11px] text-amber-800/80">
            Approve customer payments before they appear under agent balances.
          </p>
        </div>
        <span className="rounded-md border border-amber-200 bg-white px-2 py-0.5 text-[10px] font-medium text-amber-800">
          {rows.length} awaiting
        </span>
      </div>
      <div className="divide-y divide-amber-100">
        {rows.map(row => (
          <div
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">
                <CustomerProfileLink
                  branchSlug={row.customerBranchSlug}
                  customerId={row.customerId}
                  name={row.customerName || 'Customer'}
                />
              </p>
              <p className="text-xs text-slate-600">
                <span className="font-mono text-[11px] text-slate-500">{row.transactionLabel}</span>
                {' · '}
                <span className="font-mono font-semibold text-slate-900">
                  {formatFxAmount(row.amount)} {row.currency}
                </span>
                {' → '}
                <ICFundAccountLink
                  slug={accountsSlug}
                  accountId={row.collectionAccountId}
                  name={row.collectionAccountName}
                />
                {row.enteredByName ? ` · ${row.enteredByName}` : ''}
                {row.createdAt ? ` · ${new Date(row.createdAt).toLocaleString()}` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className={asicBtnOutline}
                disabled={actingId === row.id}
                onClick={() => void act(row.id, false)}
              >
                Reject
              </button>
              <button
                type="button"
                className={asicBtnPrimary}
                disabled={actingId === row.id}
                onClick={() => void act(row.id, true)}
              >
                Approve
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
