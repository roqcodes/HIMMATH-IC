'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  listCollectionAgentWalletActivityAction,
  type WalletTransactionRow,
} from '@/app/actions/icWalletActions';
import FxWalletTransactionsPanel from '@/components/ic-transfer/collection/FxWalletTransactionsPanel';
import ICFundsCurrencyBanner from '@/components/ic-funds/ICFundsCurrencyBanner';
import { formatFxAmount } from '@/lib/icTransfer/saleFxProfit';
import { ASICTableSkeleton } from '@/components/asic/ASICTableSkeleton';

type Props = {
  collectionAccountId: string;
  currency: string;
  branchSlug: string;
};

function SummaryMetric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 truncate font-mono text-lg font-bold tabular-nums leading-none text-slate-900">
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function CollectionAgentWalletActivitySection({
  collectionAccountId,
  currency,
  branchSlug,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heldBalance, setHeldBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransactionRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listCollectionAgentWalletActivityAction(collectionAccountId, branchSlug);
    if (!res.success) {
      setError(res.error || 'Failed to load wallet activity');
      setHeldBalance(0);
      setTransactions([]);
    } else {
      setHeldBalance(res.data.heldBalance);
      setTransactions(res.data.transactions);
    }
    setLoading(false);
  }, [collectionAccountId, branchSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <ASICTableSkeleton framed={false} cols={6} rows={4} />;
  }

  if (error) {
    return <p className="px-3 py-8 text-center text-sm text-red-600">{error}</p>;
  }

  const cur = currency.toUpperCase();
  const approvedIn = transactions
    .filter(tx => tx.status === 'approved' && tx.toAccountId === collectionAccountId)
    .reduce((sum, tx) => sum + tx.amount, 0);
  const transfersOut = transactions
    .filter(
      tx =>
        tx.status === 'approved' &&
        tx.transactionType === 'agent_transfer' &&
        tx.fromAccountId === collectionAccountId,
    )
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div>
      <div className="space-y-3 border-b border-slate-200 px-3 py-3">
        <ICFundsCurrencyBanner variant="fx" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <SummaryMetric
            label="Held balance"
            value={`${formatFxAmount(heldBalance)} ${cur}`}
            hint="Approved customer payments not yet remitted"
          />
          <SummaryMetric
            label="Receipts (wallet)"
            value={`${formatFxAmount(approvedIn)} ${cur}`}
            hint="Customer payments received in wallet layer"
          />
          <SummaryMetric
            label="Transfers out"
            value={transfersOut > 0 ? `${formatFxAmount(transfersOut)} ${cur}` : 'None'}
            hint="Moved to another collection agent"
          />
        </div>
      </div>
      <FxWalletTransactionsPanel
        transactions={transactions}
        loading={false}
        accountsSlug={branchSlug}
      />
    </div>
  );
}
