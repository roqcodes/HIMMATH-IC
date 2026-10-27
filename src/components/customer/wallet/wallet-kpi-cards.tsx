'use client';

import React from 'react';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import type { CustomerWalletStats } from '@/app/actions/icWalletActions';
import { formatFxAmount } from '@/lib/icTransfer/saleFxProfit';

type Props = {
  stats: CustomerWalletStats;
  currency: string;
};

export default function WalletKpiCards({ stats, currency }: Props) {
  const suffix = currency ? ` ${currency}` : '';

  return (
    <AsicKpiStrip
      metrics={[
        {
          label: 'Remaining balance',
          value: `${formatFxAmount(stats.foreignRemaining)}${suffix}`,
          hint:
            stats.openSaleCount > 0
              ? `${stats.openSaleCount} open sale${stats.openSaleCount === 1 ? '' : 's'}`
              : 'Nothing owed on foreign sales',
          tone: stats.foreignRemaining > 0 ? 'amber' : 'emerald',
        },
        {
          label: 'Credit (future sales)',
          value: `${formatFxAmount(stats.foreignCredit)}${suffix}`,
          hint: stats.foreignCredit > 0 ? 'Overpay held for later deals' : 'No unapplied credit',
          tone: stats.foreignCredit > 0 ? 'indigo' : 'slate',
        },
        {
          label: 'Paid (approved)',
          value: `${formatFxAmount(stats.foreignPaidApproved)}${suffix}`,
          hint: 'Applied to your sales after admin approval',
          tone: stats.foreignPaidApproved > 0 ? 'indigo' : 'slate',
        },
        {
          label: 'Pending approval',
          value: `${formatFxAmount(stats.pendingPaymentAmount)}${suffix}`,
          hint:
            stats.pendingPaymentCount > 0
              ? `${stats.pendingPaymentCount} payment${stats.pendingPaymentCount === 1 ? '' : 's'} awaiting admin`
              : 'No payments awaiting approval',
          tone: stats.pendingPaymentCount > 0 ? 'amber' : 'slate',
        },
        {
          label: 'Collection agents',
          value: stats.agentCount.toLocaleString(),
          hint:
            stats.agentCount > 0
              ? 'Assigned for wallet payments'
              : 'Ask admin to assign agents before paying',
          tone: stats.agentCount > 0 ? 'default' : 'amber',
        },
      ]}
    />
  );
}
