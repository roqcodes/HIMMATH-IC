'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { asicBtnPrimary } from '@/components/asic/ui';
import { getDateFilterLabel, resolveDateFilterRange } from '@/lib/dateFilterRange';
import ManageBranchesSection from '@/components/ic-transfer/branch/ManageBranchesSection';
import BranchListKpiGrid from '@/components/ic-transfer/branch/BranchListKpiGrid';
import ICTransferDateFilterBar from '@/components/ic-transfer/shared/ICTransferDateFilterBar';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import { listBranchDepositSummariesAction } from '@/app/actions/branchDepositActions';
import {
  computePortfolioBranchKpis,
  EMPTY_BRANCH_DEPOSIT_KPIS,
  type BranchDepositKpis,
} from '@/lib/icTransfer/branchDepositKpis';
import { PageShell, useICTransferFilters } from '../ui';

type Props = {
  branchCustomerIds?: string[];
};

export default function ICTransferBranches({ branchCustomerIds: _branchCustomerIds = [] }: Props) {
  const { icBranches, icSuppliers } = useApp();
  const {
    dateFilter,
    setDateFilter,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
  } = useICTransferFilters();

  const range = useMemo(
    () => resolveDateFilterRange(dateFilter, customStartDate, customEndDate),
    [dateFilter, customStartDate, customEndDate],
  );
  const rangeLabel = getDateFilterLabel(dateFilter, customStartDate, customEndDate);

  const [depositByBranchId, setDepositByBranchId] = useState<Map<string, BranchDepositKpis>>(new Map());
  const [summariesLoading, setSummariesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setSummariesLoading(true);
    void listBranchDepositSummariesAction({
      startDate: range.startDate ?? null,
      endDate: range.endDate ?? null,
    }).then(rows => {
      if (cancelled) return;
      const map = new Map<string, BranchDepositKpis>();
      for (const row of rows) {
        const { icBranchId, ...kpi } = row;
        map.set(icBranchId, kpi);
      }
      setDepositByBranchId(map);
      setSummariesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [range.startDate, range.endDate]);

  const portfolioKpis = useMemo(() => {
    const periodRows = icBranches.map(b => depositByBranchId.get(b.id) ?? EMPTY_BRANCH_DEPOSIT_KPIS);
    return computePortfolioBranchKpis(icBranches, periodRows);
  }, [icBranches, depositByBranchId]);

  const openAddBranchRef = useRef<(() => void) | null>(null);

  const addBranchButton = (
    <button
      type="button"
      className={`${asicBtnPrimary} !h-8 shrink-0 whitespace-nowrap`}
      onClick={() => openAddBranchRef.current?.()}
    >
      Add branch
    </button>
  );

  return (
    <PageShell>
      <AsicPageHeader
        title="Branches"
        subtitle="UAE shops — AED deposits and branch cash"
        actions={addBranchButton}
      />

      <ICTransferDateFilterBar
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <BranchListKpiGrid rangeLabel={rangeLabel} kpis={portfolioKpis} loading={summariesLoading} />

      <ManageBranchesSection
        branches={icBranches}
        rangeLabel={rangeLabel}
        depositByBranchId={depositByBranchId}
        icSuppliers={icSuppliers}
        registerOpenAdd={fn => {
          openAddBranchRef.current = fn;
        }}
      />
    </PageShell>
  );
}
