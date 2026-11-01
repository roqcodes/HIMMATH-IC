'use client';

import React from 'react';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';

const fmt = (n: number) =>
  `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type SalesKpiStats = {
  totalOrders: number;
  totalValue: number;
  totalUnits: number;
  totalMetalG: number;
  metalCount: number;
  cashCount: number;
  avgRate: number;
  pendingCount: number;
  partialCount: number;
  pendingVerificationCount: number;
};

export default function SalesKpiCards({ stats }: { stats: SalesKpiStats }) {
  return (
    <AsicKpiStrip
      metrics={[
        {
          label: 'Sales volume',
          value: fmt(stats.totalValue),
          hint: `${stats.cashCount} IC · ${stats.metalCount} metal`,
        },
        {
          label: 'IC units sold',
          value: stats.totalUnits.toLocaleString(),
          hint: `Avg ${fmt(stats.avgRate)}`,
        },
        {
          label: 'Metal sold',
          value: `${stats.totalMetalG.toLocaleString('en-US', { maximumFractionDigits: 4 })} g`,
          hint: 'In selected range',
          tone: 'amber',
        },
        {
          label: 'Orders',
          value: stats.totalOrders.toLocaleString(),
          hint: `${stats.pendingCount} pending`,
          tone: 'emerald',
        },
      ]}
    />
  );
}
