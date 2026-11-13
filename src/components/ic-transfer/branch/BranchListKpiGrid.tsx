'use client';

import React from 'react';
import { icfCard } from '@/components/ic-funds/ui';
import { FmtLedgerAed } from '@/lib/icFunds/format';
import { formatMetalGrams } from '@/lib/icTransfer/warehouseMatrixMetrics';
import { WarehouseKpiCell } from '@/components/warehouse/WarehouseInventoryKpiGrid';
import type { PortfolioBranchKpis } from '@/lib/icTransfer/branchDepositKpis';

type Props = {
  rangeLabel: string;
  kpis: PortfolioBranchKpis;
  loading?: boolean;
};

export default function BranchListKpiGrid({ rangeLabel, kpis, loading }: Props) {
  if (loading) {
    return (
      <div className={`${icfCard} mb-4 h-28 animate-pulse bg-slate-50/80`} aria-hidden>
        <span className="sr-only">Loading branch KPIs…</span>
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-col gap-3">
      <section className={`${icfCard} overflow-hidden`} aria-label="Branch network summary">
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 border-b border-slate-100 dark:divide-slate-800 dark:border-slate-800 sm:grid-cols-3 lg:grid-cols-6">
          <WarehouseKpiCell
            label="Branches"
            value={kpis.branchCount.toLocaleString()}
            tone="slate"
            sub={
              <span className="text-slate-400">
                {kpis.activeBranchCount} active · {rangeLabel}
              </span>
            }
          />
          <WarehouseKpiCell
            label="Period credits"
            value={<FmtLedgerAed amount={kpis.totalAed} />}
            tone="emerald"
            count={kpis.depositCount > 0 ? kpis.depositCount : undefined}
            sub={<span className="text-slate-400">Customer wallets</span>}
          />
          <WarehouseKpiCell
            label="Cash deposits"
            value={<FmtLedgerAed amount={kpis.cashAed} />}
            tone="emerald"
            count={kpis.cashCount > 0 ? kpis.cashCount : undefined}
          />
          <WarehouseKpiCell
            label="Metal deposits"
            value={<FmtLedgerAed amount={kpis.metalAed} />}
            tone="amber"
            count={kpis.metalCount > 0 ? kpis.metalCount : undefined}
            sub={
              kpis.metalWeightG > 0 ? (
                <span className="text-slate-400">{formatMetalGrams(kpis.metalWeightG)}</span>
              ) : null
            }
          />
          <WarehouseKpiCell
            label="Cash till (all)"
            value={<FmtLedgerAed amount={kpis.totalTillAed} />}
            tone="blue"
            sub={<span className="text-slate-400">HQ branch cash</span>}
          />
          <WarehouseKpiCell
            label="Deposit entries"
            value={kpis.depositCount.toLocaleString()}
            tone="slate"
            sub={
              <span className="text-slate-400">
                {kpis.cashCount} cash · {kpis.metalCount} metal
              </span>
            }
          />
        </div>
      </section>
    </div>
  );
}
