'use client';

import React from 'react';
import { icfCard } from '@/components/ic-funds/ui';
import type { WarehouseKpiMetrics } from '@/lib/warehouse/kpiMetrics';
import { formatUnits } from '@/lib/icTransfer/saleUnits';

type Props = {
  metrics: WarehouseKpiMetrics;
  variant?: 'settlement' | 'delivery';
};

function MetricCell({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'emerald' | 'amber' | 'blue' | 'indigo' | 'slate';
}) {
  const tones = {
    default: 'text-slate-900 dark:text-slate-100',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    blue: 'text-blue-600 dark:text-blue-400',
    indigo: 'text-indigo-600 dark:text-indigo-400',
    slate: 'text-slate-500 dark:text-slate-400',
  };

  return (
    <div className="px-3 py-2.5">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className={`mt-0.5 truncate text-lg font-bold tabular-nums leading-none sm:text-xl ${tones[tone]}`}>
        {value}
      </p>
      {hint && (
        <p className="mt-1 truncate text-[11px] text-slate-400 dark:text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

export default function WarehouseOrderKpiGrid({ metrics, variant = 'settlement' }: Props) {
  const isDelivery = variant === 'delivery';

  return (
    <section className={`${icfCard} mb-3 overflow-hidden`} aria-label="Order summary metrics">
      <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 dark:divide-slate-800 sm:grid-cols-4">
        <div className="bg-[var(--theme-surface)]">
          <MetricCell
            label={isDelivery ? 'Total Assigned' : 'Current Stock'}
            value={formatUnits(metrics.currentStock ?? 0)}
            hint={isDelivery ? 'Total units assigned' : 'On hand in warehouse'}
          />
        </div>
        <div className="bg-[var(--theme-surface)]">
          <MetricCell
            label={isDelivery ? 'To Deliver' : 'Reserved'}
            value={formatUnits(metrics.reserved)}
            hint={isDelivery ? 'Pending delivery' : 'Allocated to active orders'}
            tone="amber"
          />
        </div>
        <div className="bg-[var(--theme-surface)]">
          <MetricCell
            label={isDelivery ? 'Delivered' : 'Available'}
            value={formatUnits(metrics.remaining)}
            hint={isDelivery ? 'Successfully delivered' : 'Stock for new orders'}
            tone="emerald"
          />
        </div>
        <div className="bg-[var(--theme-surface)]">
          <MetricCell
            label="Total Orders"
            value={metrics.totalOrders.toLocaleString()}
            hint={`${metrics.totalCompleted} completed · ${metrics.totalPending} pending`}
            tone="indigo"
          />
        </div>
      </div>
    </section>
  );
}
