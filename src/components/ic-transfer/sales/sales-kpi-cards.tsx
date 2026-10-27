'use client';

import React from 'react';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';

const fmt = (n: number) =>
  `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type SalesKpiStats = {
  totalOrders: number;
  totalValue: number;
  totalUnits: number;
  avgRate: number;
  pendingCount: number;
  partialCount: number;
  pendingVerificationCount: number;
  totalPartialUnitsDelivered: number;
};

export default function SalesKpiCards({ stats }: { stats: SalesKpiStats }) {
  const activeCount = stats.pendingCount + stats.partialCount + stats.pendingVerificationCount;

  return (
    <AsicKpiStrip
      metrics={[
        {
          label: 'Total orders',
          value: stats.totalOrders.toLocaleString(),
          hint: fmt(stats.totalValue),
        },
        {
          label: 'Total units',
          value: stats.totalUnits.toLocaleString(),
          hint: `Avg ${fmt(stats.avgRate)}`,
        },
        {
          label: 'Active',
          value: activeCount.toLocaleString(),
          hint: `${stats.pendingVerificationCount} awaiting verification`,
          tone: 'amber',
        },
        {
          label: 'Partial',
          value: stats.partialCount.toLocaleString(),
          hint: `${stats.totalPartialUnitsDelivered.toLocaleString()} units delivered`,
          tone: 'indigo',
        },
      ]}
    />
  );
}
