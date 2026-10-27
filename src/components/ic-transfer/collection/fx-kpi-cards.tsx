'use client';

import React from 'react';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import { formatCurrencyBreakdown } from '@/lib/icFunds/currencyPolicy';
import { fmtLedgerAed } from '@/lib/icFunds/format';
import { formatFxAmount } from '@/lib/icTransfer/saleFxProfit';

export type FxKpiStats = {
  customerCount: number;
  customersWithoutAgents: number;
  customersNeedingProfile: number;
  pendingPayments: number;
  pendingSettlementRequests: number;
  foreignByCurrency: Record<string, number>;
  agentByCurrency: Record<string, number>;
  /** Legacy single-number totals — do not sum mixed currencies */
  totalForeignRemaining: number;
  totalAgentBalance: number;
  totalType2Booked: number;
};

export default function FxKpiCards({ stats }: { stats: FxKpiStats }) {
  const customerOwed = formatCurrencyBreakdown(stats.foreignByCurrency, formatFxAmount);
  const onAgents = formatCurrencyBreakdown(stats.agentByCurrency, formatFxAmount);

  return (
    <AsicKpiStrip
      metrics={[
        {
          label: 'FX customers',
          value: stats.customerCount.toLocaleString(),
          hint:
            stats.customersNeedingProfile > 0
              ? `${stats.customersNeedingProfile} need profile currency`
              : `${stats.customersWithoutAgents} without agents`,
          tone: stats.customersWithoutAgents > 0 ? 'amber' : 'default',
        },
        {
          label: 'Customer owed',
          value: customerOwed.display,
          hint: customerOwed.isMixed
            ? 'Per currency — not summed (foreign layer)'
            : 'Foreign still owed on completed sales',
          tone: Object.keys(stats.foreignByCurrency).length > 0 ? 'amber' : 'emerald',
        },
        {
          label: 'On agents',
          value: onAgents.display,
          hint: onAgents.isMixed
            ? 'Per currency — wallet balance awaiting FX settle'
            : 'Approved wallet balance awaiting FX settle',
          tone: Object.keys(stats.agentByCurrency).length > 0 ? 'indigo' : 'slate',
        },
        {
          label: 'Type 2 booked',
          value: fmtLedgerAed(stats.totalType2Booked),
          hint:
            stats.pendingSettlementRequests > 0
              ? `${stats.pendingSettlementRequests} agent remittance${stats.pendingSettlementRequests === 1 ? '' : 's'} pending`
              : stats.pendingPayments > 0
                ? `${stats.pendingPayments} payment${stats.pendingPayments === 1 ? '' : 's'} pending approval`
                : `Lifetime FX profit in ledger (${fmtLedgerAed(stats.totalType2Booked).split(' ')[1]})`,
          tone: 'emerald',
        },
      ]}
    />
  );
}
