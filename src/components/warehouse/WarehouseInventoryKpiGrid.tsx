'use client';

import React from 'react';
import { icfCard } from '@/components/ic-funds/ui';
import { FmtLedgerAed, FmtLedgerInr } from '@/lib/icFunds/format';
import type { WarehouseInventoryTotals } from '@/lib/icTransfer/warehouseMatrixMetrics';
import type { DealBookPair } from '@/lib/icTransfer/dealBookKpis';
import { formatMetalGrams } from '@/lib/icTransfer/warehouseMatrixMetrics';
import { INR_PER_UNIT } from '@/lib/icTransfer/rateCalculations';

type Props = {
  metrics: WarehouseInventoryTotals;
  books: DealBookPair;
  rangeLabel: string;
};

/** Weighted avg AED **rate** per IC unit (~36), not a dirham amount. */
function formatIcAvgAedRate(rate: number): string {
  if (!Number.isFinite(rate) || Math.abs(rate) < 0.00005) return '';
  return rate.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function KpiCell({
  label,
  value,
  tone = 'default',
  align = 'left',
  count,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'emerald' | 'amber' | 'red' | 'blue' | 'slate';
  align?: 'left' | 'right' | 'center';
  count?: number;
  sub?: React.ReactNode;
}) {
  const tones = {
    default: 'text-slate-900 dark:text-slate-100',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
    blue: 'text-blue-600 dark:text-blue-400',
    slate: 'text-slate-500 dark:text-slate-400',
  };

  const alignClass = {
    left: 'text-left',
    right: 'text-right',
    center: 'text-center',
  };

  return (
    <div className={`px-3 py-2.5 ${alignClass[align]}`}>
      <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <div className={`truncate text-sm font-bold tabular-nums leading-tight sm:text-base ${tones[tone]}`}>
          {value}
        </div>
        {count !== undefined && (
          <span
            className="shrink-0 rounded-md border border-slate-200/90 bg-slate-100/80 px-1.5 py-px text-xs font-semibold tabular-nums text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
            title={`${count.toLocaleString()} in range`}
          >
            {count.toLocaleString()}
          </span>
        )}
      </div>
      {sub ? (
        <div className="mt-0.5 text-[11px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">{sub}</div>
      ) : null}
    </div>
  );
}

export default function WarehouseInventoryKpiGrid({ metrics, books, rangeLabel }: Props) {
  return (
    <div className="mb-8 flex flex-col gap-4">
      {/* Container 1: Inventory & Transactions */}
      <section className={`${icfCard} overflow-hidden`} aria-label="Inventory & Transactions">
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 border-b border-slate-100 dark:divide-slate-800 dark:border-slate-800 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCell
            label="IC Purchases"
            value={<FmtLedgerInr amount={metrics.cashPurchaseInr} />}
            tone="red"
            count={metrics.cashPurchases}
            sub={
              Math.abs(metrics.cashPurchaseAed) >= 0.005 ? (
                <span className="text-slate-400">
                  Booked <FmtLedgerAed amount={metrics.cashPurchaseAed} />
                </span>
              ) : null
            }
          />
          <KpiCell
            label="IC Sales"
            value={<FmtLedgerInr amount={metrics.cashSaleInr} />}
            tone="emerald"
            count={metrics.cashSales}
            sub={
              Math.abs(metrics.cashSaleAed) >= 0.005 ? (
                <span className="text-slate-400">
                  Booked <FmtLedgerAed amount={metrics.cashSaleAed} />
                </span>
              ) : null
            }
          />
          <KpiCell
            label="IC Stock"
            value={<FmtLedgerInr amount={metrics.currentStock * INR_PER_UNIT} />}
            sub={
              Math.abs(metrics.icStockAvgAedRate) >= 0.00005 ? (
                <span
                  title="Weighted average AED rate per IC unit (cash IC purchases + metal INR sales that add stock)."
                  className="inline-flex flex-wrap items-baseline gap-x-1"
                >
                  <span className="font-semibold text-slate-400 dark:text-slate-500">Avg rate</span>
                  <span className="tabular-nums text-slate-600 dark:text-slate-300">
                    {formatIcAvgAedRate(metrics.icStockAvgAedRate)}
                  </span>
                </span>
              ) : (
                <span className="text-slate-400">Avg rate —</span>
              )
            }
          />

          <KpiCell 
            label="Metal Purchases" 
            value={<FmtLedgerInr amount={metrics.metalPurchaseInr} />} 
            tone="red"
            count={metrics.metalPurchases}
          />
          <KpiCell 
            label="Metal Sales" 
            value={<FmtLedgerInr amount={metrics.metalSaleInr} />} 
            tone="emerald"
            count={metrics.metalSales}
          />
          <KpiCell
            label="Metal Stock"
            value={
              <span className="flex flex-col gap-0.5">
                <span>{formatMetalGrams(metrics.currentMetalG)}</span>
                {Math.abs(metrics.metalStockInr) >= 0.005 ? (
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    <FmtLedgerInr amount={metrics.metalStockInr} />
                  </span>
                ) : null}
              </span>
            }
            tone="amber"
          />
        </div>

        <div className="grid grid-cols-2 divide-x divide-slate-100 bg-slate-50/50 dark:divide-slate-800 dark:bg-slate-900/20">
          <div className="px-3 py-2">
             <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">IC P&L</span>
                <span className="text-[11px] text-slate-400">{rangeLabel}</span>
             </div>
             <p
                className={`text-base font-bold tabular-nums sm:text-lg ${metrics.cashGrossProfitAed >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
             >
                <FmtLedgerAed amount={metrics.cashGrossProfitAed} />
             </p>
          </div>
          <div className="px-3 py-2">
             <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Metal P&L</span>
                <span className="text-[11px] text-slate-400">{rangeLabel}</span>
             </div>
             <p className={`text-base font-bold tabular-nums sm:text-lg ${metrics.metalProfitInr >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                <FmtLedgerInr amount={metrics.metalProfitInr} />
             </p>
          </div>
        </div>
      </section>

      {/* Container 2: Accounts Summary (AED & INR) */}
      <section className={`${icfCard} overflow-hidden`} aria-label="Accounts Summary">
        <div className="bg-slate-50/30 px-3 py-1.5 border-b border-slate-100 dark:bg-slate-900/10 dark:border-slate-800">
           <h4 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Accounts Summary</h4>
        </div>
        
        {/* AED Row */}
        <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100 dark:divide-slate-800 dark:border-slate-800 sm:grid-cols-4">
          <KpiCell 
            label="AED Opening" 
            value={<FmtLedgerAed amount={books.aed.opening} />} 
            tone="slate"
          />
          <KpiCell 
            label="AED Purchases (Dr)" 
            value={<FmtLedgerAed amount={books.aed.periodDebit} />} 
            tone="red"
          />
          <KpiCell 
            label="AED Sales (Cr)" 
            value={<FmtLedgerAed amount={books.aed.periodCredit} />} 
            tone="emerald"
          />
          <KpiCell 
            label="AED Closing" 
            value={<FmtLedgerAed amount={books.aed.closing} />} 
            tone={books.aed.closing >= 0 ? 'emerald' : 'red'}
          />
        </div>

        {/* INR Row */}
        <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800 sm:grid-cols-4">
          <KpiCell 
            label="INR Opening" 
            value={<FmtLedgerInr amount={books.inr.opening} />} 
            tone="slate"
          />
          <KpiCell 
            label="INR Purchases (Dr)" 
            value={<FmtLedgerInr amount={books.inr.periodDebit} />} 
            tone="red"
          />
          <KpiCell 
            label="INR Sales (Cr)" 
            value={<FmtLedgerInr amount={books.inr.periodCredit} />} 
            tone="emerald"
          />
          <KpiCell 
            label="INR Closing" 
            value={<FmtLedgerInr amount={books.inr.closing} />} 
            tone={books.inr.closing >= 0 ? 'emerald' : 'red'}
          />
        </div>
      </section>
    </div>
  );
}
