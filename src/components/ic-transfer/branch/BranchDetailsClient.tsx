'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { notFound } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import ICTransferDateFilterBar from '@/components/ic-transfer/shared/ICTransferDateFilterBar';
import { resolveDateFilterRange, getDateFilterLabel } from '@/lib/dateFilterRange';
import { useICTransferFilters } from '@/components/ic-transfer/ui';
import { asicBtnOutline } from '@/components/asic/ui';
import { getICTransferBranchBase, type ICTransferPortalMode } from '@/lib/icTransfer/branchPortalScope';
import { findIcBranchByRouteParam } from '@/lib/icTransfer/findIcBranchByRouteParam';
import BranchDetailKpiGrid from '@/components/ic-transfer/branch/BranchDetailKpiGrid';
import BranchDetailTabs from '@/components/ic-transfer/branch/BranchDetailTabs';
import BranchModal from '@/components/ic-transfer/branch/BranchModal';
import BranchDepositModal from '@/components/ic-transfer/branch/BranchDepositModal';
import type { BranchDetailContentTab } from '@/components/ic-transfer/branch/BranchDetailDepositsPanel';
import type { ICBranchDeposit } from '@/types';
import { computeBranchDepositKpis } from '@/lib/icTransfer/branchDepositKpis';
import { useWriteAccess } from '@/context/RbacWriteContext';

const subtleTxnBtnBase =
  'inline-flex h-8 max-md:h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium shadow-surface-xs transition-colors disabled:pointer-events-none disabled:opacity-45';

const subtleSaleBtnClass = `${subtleTxnBtnBase} border-emerald-200/90 bg-emerald-50/70 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100/80 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100 dark:hover:bg-emerald-950/50`;

type Props = {
  branchSlug: string;
  branchId: string;
  portalMode?: ICTransferPortalMode;
};

export default function BranchDetailsClient({
  branchSlug,
  branchId,
  portalMode = 'admin',
}: Props) {
  const { icBranches, icSuppliers, refreshAppData } = useApp();
  const { canWrite, buttonProps: wp } = useWriteAccess();

  const [editOpen, setEditOpen] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [depositRefreshToken, setDepositRefreshToken] = useState(0);
  const [viewTab, setViewTab] = useState<BranchDetailContentTab>('all');
  const [periodDeposits, setPeriodDeposits] = useState<ICBranchDeposit[]>([]);

  const {
    dateFilter,
    setDateFilter,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
  } = useICTransferFilters();

  const branch = useMemo(
    () => findIcBranchByRouteParam(icBranches, branchId),
    [icBranches, branchId],
  );

  const range = useMemo(
    () => resolveDateFilterRange(dateFilter, customStartDate, customEndDate),
    [dateFilter, customStartDate, customEndDate],
  );

  const rangeLabel = useMemo(
    () => getDateFilterLabel(dateFilter, customStartDate, customEndDate),
    [dateFilter, customStartDate, customEndDate],
  );

  const branchSubtitle = useMemo(() => {
    if (!branch) return undefined;
    const managerNames =
      branch.managerIds?.length &&
      branch.managerIds
        .map(id => icSuppliers.find(s => s.id === id)?.name)
        .filter(Boolean)
        .join(', ');
    const parts = [branch.address?.trim(), branch.phone?.trim(), managerNames ? `Managers: ${managerNames}` : undefined].filter(
      Boolean,
    );
    return parts.length > 0 ? parts.join(' · ') : 'UAE branch · customer AED deposits';
  }, [branch, icSuppliers]);

  const branchDepositKpis = useMemo(() => computeBranchDepositKpis(periodDeposits), [periodDeposits]);

  const depositModeCounts = useMemo(() => {
    let cash = 0;
    let metal = 0;
    for (const d of periodDeposits) {
      if (d.settlementMode === 'metal') metal += 1;
      else cash += 1;
    }
    return { all: periodDeposits.length, cash, metal };
  }, [periodDeposits]);

  const handleDepositsLoaded = useCallback((rows: ICBranchDeposit[]) => {
    setPeriodDeposits(rows);
  }, []);

  if (!branch && icBranches.length > 0) {
    return notFound();
  }
  if (!branch) return null;

  const listHref = getICTransferBranchBase(portalMode, branchSlug);
  const depositBlocked = !canWrite;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AsicPageHeader
        breadcrumbs={[{ label: 'Branches', href: listHref }, { label: branch.name }]}
        subtitle={branchSubtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`${subtleSaleBtnClass}${depositBlocked ? ' cursor-not-allowed' : ''}`}
              onClick={depositBlocked ? undefined : () => setDepositModalOpen(true)}
              aria-label="Record AED deposit at this branch"
              {...wp({ disabled: depositBlocked })}
            >
              Deposit
            </button>
            <button
              type="button"
              className={`${asicBtnOutline}${!canWrite ? ' cursor-not-allowed opacity-50' : ''}`}
              onClick={canWrite ? () => setEditOpen(true) : undefined}
              {...wp()}
            >
              Edit branch
            </button>
          </div>
        }
      />

      <ICTransferDateFilterBar
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <BranchDetailKpiGrid
        rangeLabel={rangeLabel}
        branchCashBalance={branch.cashBalance ?? null}
        openingAed={0}
        depositKpis={branchDepositKpis}
        icBranchId={branch.id}
        icFundsSlug={branchSlug}
      />

      <BranchDetailTabs
        icBranchId={branch.id}
        branchSlug={branchSlug}
        range={range}
        rangeLabel={rangeLabel}
        refreshToken={depositRefreshToken}
        onDepositsLoaded={handleDepositsLoaded}
        modeTab={viewTab}
        onModeTabChange={setViewTab}
        depositModeCounts={depositModeCounts}
        canDelete={canWrite}
        onDeleted={() => setDepositRefreshToken(t => t + 1)}
      />

      <BranchModal open={editOpen} branch={branch} onClose={() => setEditOpen(false)} onSaved={() => setEditOpen(false)} />

      <BranchDepositModal
        open={depositModalOpen}
        branch={branch}
        branchSlug={branchSlug}
        onClose={() => setDepositModalOpen(false)}
        onSaved={() => {
          setDepositRefreshToken(t => t + 1);
          void refreshAppData();
        }}
      />
    </div>
  );
}
