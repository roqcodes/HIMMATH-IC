'use client';

import React, { useEffect, useState } from 'react';
import { icfCard } from '@/components/ic-funds/ui';
import { FmtLedgerAed } from '@/lib/icFunds/format';
import { formatMetalGrams } from '@/lib/icTransfer/warehouseMatrixMetrics';
import { WarehouseKpiCell } from '@/components/warehouse/WarehouseInventoryKpiGrid';
import type { BranchDepositKpis } from '@/lib/icTransfer/branchDepositKpis';
import { resolveBranchTillAccountAction } from '@/app/actions/icFundsActions';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import { HQ_IC_FUNDS_BRANCH_SLUG } from '@/lib/icFunds/hqBranch';

type Props = {
  rangeLabel: string;
  branchCashBalance: number | null;
  openingAed?: number;
  depositKpis: BranchDepositKpis;
  icBranchId?: string | null;
  icFundsSlug?: string;
};

export default function BranchDetailKpiGrid({
  rangeLabel,
  branchCashBalance,
  openingAed = 0,
  depositKpis,
  icBranchId,
  icFundsSlug,
}: Props) {
  const fundsSlug = icFundsSlug || HQ_IC_FUNDS_BRANCH_SLUG;
  const [tillAccount, setTillAccount] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const id = icBranchId?.trim();
    if (!id) {
      setTillAccount(null);
      return;
    }
    void resolveBranchTillAccountAction(id).then(setTillAccount);
  }, [icBranchId]);
  const kpis = depositKpis;
  const till = branchCashBalance ?? 0;

  return (
    <div className="mb-8 flex flex-col gap-4">
      <section className={`${icfCard} overflow-hidden`} aria-label="Deposits and till">
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 border-b border-slate-100 dark:divide-slate-800 dark:border-slate-800 sm:grid-cols-3 lg:grid-cols-6">
          <WarehouseKpiCell
            label="Cash deposits"
            value={<FmtLedgerAed amount={kpis.cashAed} />}
            tone="emerald"
            count={kpis.cashCount}
          />
          <WarehouseKpiCell
            label="Metal deposits"
            value={<FmtLedgerAed amount={kpis.metalAed} />}
            tone="amber"
            count={kpis.metalCount}
            sub={
              kpis.metalWeightG > 0 ? (
                <span className="text-slate-400">{formatMetalGrams(kpis.metalWeightG)}</span>
              ) : null
            }
          />
          <WarehouseKpiCell
            label="AED till"
            value={branchCashBalance != null ? <FmtLedgerAed amount={till} /> : '—'}
            tone="blue"
            sub={
              tillAccount ? (
                <ICFundAccountLink
                  slug={fundsSlug}
                  accountId={tillAccount.id}
                  name={tillAccount.name}
                  className="text-[11px] text-sky-700 hover:underline"
                />
              ) : (
                <span className="text-slate-400">Branch cash balance</span>
              )
            }
          />
          <WarehouseKpiCell
            label="Total credited"
            value={<FmtLedgerAed amount={kpis.totalAed} />}
            tone="emerald"
            count={kpis.depositCount}
            sub={<span className="text-slate-400">Customer wallets</span>}
          />
          <WarehouseKpiCell
            label="Metal weight"
            value={formatMetalGrams(kpis.metalWeightG) || '0 g'}
            tone="amber"
            count={kpis.metalCount > 0 ? kpis.metalCount : undefined}
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

        <div className="grid grid-cols-2 divide-x divide-slate-100 bg-slate-50/50 dark:divide-slate-800 dark:bg-slate-900/20">
          <div className="px-3 py-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Period credits (AED)
              </span>
              <span className="text-[11px] text-slate-400">{rangeLabel}</span>
            </div>
            <p className="text-base font-bold tabular-nums text-emerald-600 sm:text-lg">
              <FmtLedgerAed amount={kpis.totalAed} />
            </p>
          </div>
          <div className="px-3 py-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Cash till (AED)
              </span>
              <span className="text-[11px] text-slate-400">{rangeLabel}</span>
            </div>
            <p className="text-base font-bold tabular-nums text-slate-900 sm:text-lg dark:text-slate-100">
              {branchCashBalance != null ? <FmtLedgerAed amount={till} /> : '—'}
            </p>
          </div>
        </div>
      </section>

      <section className={`${icfCard} overflow-hidden`} aria-label="Accounts Summary">
        <div className="border-b border-slate-100 bg-slate-50/30 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900/10">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Accounts Summary</h4>
        </div>

        <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800 sm:grid-cols-4">
          <WarehouseKpiCell label="AED opening" value={<FmtLedgerAed amount={openingAed} />} tone="slate" />
          <WarehouseKpiCell
            label="Deposits (Cr)"
            value={<FmtLedgerAed amount={kpis.totalAed} />}
            tone="emerald"
          />
          <WarehouseKpiCell
            label="Cash entries"
            value={<FmtLedgerAed amount={kpis.cashAed} />}
            tone="emerald"
            count={kpis.cashCount}
          />
          <WarehouseKpiCell
            label="AED closing"
            value={branchCashBalance != null ? <FmtLedgerAed amount={till} /> : '—'}
            tone={till >= 0 ? 'amber' : 'red'}
          />
        </div>
      </section>
    </div>
  );
}
