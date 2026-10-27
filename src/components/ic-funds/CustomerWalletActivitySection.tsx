'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  getCustomerWalletSummaryAction,
  type CustomerWalletPaymentRow,
} from '@/app/actions/icWalletActions';
import WalletPaymentsPanel from '@/components/customer/wallet/WalletPaymentsPanel';
import ICFundsCurrencyBanner from '@/components/ic-funds/ICFundsCurrencyBanner';
import { formatFxAmount } from '@/lib/icTransfer/saleFxProfit';
import { ASICTableSkeleton } from '@/components/asic/ASICTableSkeleton';

type Props = {
  customerId: string;
  branchSlug?: string;
  currency: string;
  refreshKey?: number;
};

function SummaryMetric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--theme-border-subtle)] bg-[var(--theme-surface)] px-3 py-2.5">
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 truncate font-mono text-lg font-bold tabular-nums leading-none text-slate-900 dark:text-[var(--theme-text)]">
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function CustomerWalletActivitySection({
  customerId,
  branchSlug,
  currency,
  refreshKey = 0,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<CustomerWalletPaymentRow[]>([]);
  const [stats, setStats] = useState<{
    foreignPaidApproved: number;
    foreignRemaining: number;
    pendingPaymentCount: number;
    pendingPaymentAmount: number;
    foreignCredit: number;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getCustomerWalletSummaryAction(customerId, branchSlug);
    if (!res.success) {
      setError(res.error || 'Failed to load wallet activity');
      setPayments([]);
      setStats(null);
    } else {
      setPayments(res.payments ?? []);
      setStats({
        foreignPaidApproved: res.stats.foreignPaidApproved,
        foreignRemaining: res.foreignRemaining,
        pendingPaymentCount: res.stats.pendingPaymentCount,
        pendingPaymentAmount: res.stats.pendingPaymentAmount,
        foreignCredit: res.stats.foreignCredit,
      });
    }
    setLoading(false);
  }, [customerId, branchSlug]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (loading) {
    return <ASICTableSkeleton framed={false} cols={5} rows={4} />;
  }

  if (error) {
    return <p className="py-6 text-center text-sm text-red-600">{error}</p>;
  }

  const cur = currency.toUpperCase();

  return (
    <div className="space-y-3">
      <ICFundsCurrencyBanner variant="fx" />

      {stats ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryMetric
            label="Paid (approved)"
            value={`${formatFxAmount(stats.foreignPaidApproved)} ${cur}`}
            hint="Allocated to sales after admin approval"
          />
          <SummaryMetric
            label="Remaining owed"
            value={`${formatFxAmount(stats.foreignRemaining)} ${cur}`}
            hint={stats.foreignRemaining > 0 ? 'Still due on open sales' : 'Foreign sales settled'}
          />
          <SummaryMetric
            label="Pending approval"
            value={
              stats.pendingPaymentCount > 0
                ? `${formatFxAmount(stats.pendingPaymentAmount)} ${cur}`
                : 'None'
            }
            hint={
              stats.pendingPaymentCount > 0
                ? `${stats.pendingPaymentCount} payment(s) awaiting admin`
                : 'No payments in review'
            }
          />
          <SummaryMetric
            label="Unapplied credit"
            value={`${formatFxAmount(stats.foreignCredit)} ${cur}`}
            hint="Held for future sales"
          />
        </div>
      ) : null}

      <div className="-mx-3 -mb-3 overflow-hidden rounded-b-lg border-t border-[var(--theme-border-subtle)]">
        <WalletPaymentsPanel payments={payments ?? []} loading={false} />
      </div>
    </div>
  );
}
