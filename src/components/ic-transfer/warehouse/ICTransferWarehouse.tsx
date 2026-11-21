'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { asicBtnPrimary } from '@/components/asic/ui';
import AddPurchaseModal from '@/components/ic-transfer/purchase/AddPurchaseModal';
import AddSaleModal from '@/components/ic-transfer/sales/AddSaleModal';
import { useWriteAccess } from '@/context/RbacWriteContext';
import { resolveDateFilterRange, getDateFilterLabel } from '@/lib/dateFilterRange';
import { computeWarehouseMatrix } from '@/lib/icTransfer/warehouseMatrixMetrics';
import {
  filterSalesForBranchPortal,
  filterPurchasesForBranchPortal,
  filterIndiaWarehouses,
  filterWarehousesForBranchPortal,
  filterWarehousesForAdminPortal,
  type ICTransferPortalMode,
} from '@/lib/icTransfer/branchPortalScope';
import ManageWarehousesSection from '@/components/ic-transfer/warehouse/ManageWarehousesSection';
import ICTransferDateFilterBar from '@/components/ic-transfer/shared/ICTransferDateFilterBar';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import WarehouseInventoryKpiGrid from '@/components/warehouse/WarehouseInventoryKpiGrid';
import { subtlePurchaseBtnClass, subtleSaleBtnClass } from './warehouseActionButtonStyles';
import { computeCombinedTradeBookKpis } from '@/lib/icTransfer/dealBookKpis';
import { HQ_IC_FUNDS_BRANCH_ID } from '@/lib/icFunds/hqBranch';
import { useWarehouseInrLedgerKpis } from '@/lib/icTransfer/useWarehouseInrLedgerKpis';
import { useICTransferRegionFilter } from '@/components/ic-transfer/shared/ICTransferFilterProvider';
import {
  PageShell,
  useICTransferFilters,
} from '../ui';

type Props = {
  portalMode?: ICTransferPortalMode;
  branchId?: string;
  branchName?: string;
  branchCustomerIds?: string[];
};

export default function ICTransferWarehouse({
  portalMode = 'admin',
  branchId,
  branchName,
  branchCustomerIds = [],
}: Props) {
  const { icRegions, icWarehouses, icSales, icPurchases, icTransferSettings } = useApp();
  const { canWrite, buttonProps: wp } = useWriteAccess();
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [inrLedgerRefreshToken, setInrLedgerRefreshToken] = useState(0);
  const {
    dateFilter,
    setDateFilter,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
  } = useICTransferFilters();
  const { selectedRegionIds } = useICTransferRegionFilter();

  const isBranchPortal = portalMode === 'branch' && !!branchId;

  const scopedWarehouses = useMemo(() => {
    const base = isBranchPortal
      ? filterWarehousesForBranchPortal(icWarehouses, branchId!)
      : filterWarehousesForAdminPortal(icWarehouses);
    return filterIndiaWarehouses(base);
  }, [icWarehouses, isBranchPortal, branchId]);

  const branchCustomerIdSet = useMemo(
    () => new Set(branchCustomerIds),
    [branchCustomerIds],
  );

  const scopedSales = useMemo(() => {
    if (!isBranchPortal || !branchName) return icSales;
    return filterSalesForBranchPortal(icSales, branchName, branchCustomerIdSet);
  }, [icSales, isBranchPortal, branchName, branchCustomerIdSet]);

  const scopedPurchases = useMemo(() => {
    if (!isBranchPortal || !branchId) return icPurchases;
    return filterPurchasesForBranchPortal(icPurchases, icWarehouses, branchId);
  }, [icPurchases, icWarehouses, isBranchPortal, branchId]);

  const range = useMemo(
    () => resolveDateFilterRange(dateFilter, customStartDate, customEndDate),
    [dateFilter, customStartDate, customEndDate],
  );

  const rangeLabel = useMemo(
    () => getDateFilterLabel(dateFilter, customStartDate, customEndDate),
    [dateFilter, customStartDate, customEndDate],
  );

  const { rows, totals } = useMemo(
    () =>
      computeWarehouseMatrix({
        warehouses: scopedWarehouses,
        regions: icRegions,
        purchases: scopedPurchases,
        sales: scopedSales,
        range,
        regionIds: selectedRegionIds.length > 0 ? selectedRegionIds : undefined,
      }),
    [scopedWarehouses, icRegions, scopedPurchases, scopedSales, range, selectedRegionIds],
  );

  const dealBookKpis = useMemo(
    () => computeCombinedTradeBookKpis(scopedPurchases, scopedSales, range, {
      aed: scopedWarehouses.reduce((sum, warehouse) => sum + (Number(warehouse.openingAed) || 0), 0),
      inr: scopedWarehouses.reduce((sum, warehouse) => sum + (Number(warehouse.openingInr) || 0), 0),
    }),
    [scopedPurchases, scopedSales, scopedWarehouses, range],
  );
  const ledgerWarehouses = useMemo(
    () => selectedRegionIds.length
      ? scopedWarehouses.filter((warehouse) => warehouse.regionId && selectedRegionIds.includes(warehouse.regionId))
      : scopedWarehouses,
    [scopedWarehouses, selectedRegionIds],
  );
  const { data: warehouseInrLedgers, status: inrLedgerStatus } = useWarehouseInrLedgerKpis({
    branchId: isBranchPortal ? branchId! : HQ_IC_FUNDS_BRANCH_ID,
    warehouseIds: ledgerWarehouses.map((warehouse) => warehouse.id),
    startDate: range.startDate,
    endDate: range.endDate,
    refreshKey: inrLedgerRefreshToken,
  });
  const tradeBookKpis = useMemo(() => {
    const inr = Object.values(warehouseInrLedgers).reduce(
      (sum, ledger) => ({
        opening: sum.opening + ledger.opening,
        periodDebit: sum.periodDebit + ledger.periodDebit,
        periodCredit: sum.periodCredit + ledger.periodCredit,
        closing: sum.closing + ledger.closing,
        accountFound: sum.accountFound && ledger.accountFound,
      }),
      { opening: 0, periodDebit: 0, periodCredit: 0, closing: 0, accountFound: true },
    );
    return { ...dealBookKpis, inr };
  }, [dealBookKpis, warehouseInrLedgers]);

  const openAddWarehouseRef = useRef<(() => void) | null>(null);

  const addWarehouseButton = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={`${subtlePurchaseBtnClass}${!canWrite ? ' cursor-not-allowed' : ''}`}
        onClick={canWrite ? () => setPurchaseModalOpen(true) : undefined}
        aria-label="Add purchase"
        {...wp({ disabled: !canWrite })}
      >
        Add purchase
      </button>
      <button
        type="button"
        className={`${subtleSaleBtnClass}${!canWrite || !icTransferSettings.salesEnabled ? ' cursor-not-allowed' : ''}`}
        onClick={canWrite && icTransferSettings.salesEnabled ? () => setSaleModalOpen(true) : undefined}
        aria-label="Add sale"
        {...wp({ disabled: !canWrite || !icTransferSettings.salesEnabled })}
      >
        Add sale
      </button>
      <button
        type="button"
        className={`${asicBtnPrimary} !h-8 shrink-0 whitespace-nowrap`}
        onClick={() => openAddWarehouseRef.current?.()}
      >
        Add Warehouse
      </button>
    </div>
  );

  return (
    <PageShell>
      <AsicPageHeader title="Warehouses" actions={addWarehouseButton} />

      <ICTransferDateFilterBar
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <WarehouseInventoryKpiGrid
        metrics={totals}
        books={tradeBookKpis}
        rangeLabel={rangeLabel}
        inrLedgerStatus={inrLedgerStatus}
      />

      <ManageWarehousesSection
        portalMode={portalMode}
        branchId={isBranchPortal ? branchId : undefined}
        warehouses={scopedWarehouses}
        matrixRows={rows}
        rangeLabel={rangeLabel}
        registerOpenAdd={fn => {
          openAddWarehouseRef.current = fn;
        }}
      />

      <AddPurchaseModal
        open={purchaseModalOpen}
        onClose={() => {
          setPurchaseModalOpen(false);
          setInrLedgerRefreshToken((token) => token + 1);
        }}
        branchId={isBranchPortal ? branchId : undefined}
        warehouses={isBranchPortal ? scopedWarehouses : undefined}
      />
      <AddSaleModal
        open={saleModalOpen}
        onClose={() => {
          setSaleModalOpen(false);
          setInrLedgerRefreshToken((token) => token + 1);
        }}
        branchId={isBranchPortal ? branchId : undefined}
        warehouses={isBranchPortal ? scopedWarehouses : undefined}
      />
    </PageShell>
  );
}
