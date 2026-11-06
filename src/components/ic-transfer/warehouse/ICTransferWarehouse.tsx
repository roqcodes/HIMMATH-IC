'use client';

import React, { useMemo, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { asicBtnPrimary } from '@/components/asic/ui';
import { resolveDateFilterRange, getDateFilterLabel } from '@/lib/dateFilterRange';
import { computeWarehouseMatrix } from '@/lib/icTransfer/warehouseMatrixMetrics';
import {
  filterSalesForBranchPortal,
  filterPurchasesForBranchPortal,
  filterWarehousesForBranchPortal,
  filterWarehousesForAdminPortal,
  type ICTransferPortalMode,
} from '@/lib/icTransfer/branchPortalScope';
import ManageWarehousesSection from '@/components/ic-transfer/warehouse/ManageWarehousesSection';
import ICTransferDateFilterBar from '@/components/ic-transfer/shared/ICTransferDateFilterBar';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import WarehouseInventoryKpiGrid from '@/components/warehouse/WarehouseInventoryKpiGrid';
import { computeCombinedTradeBookKpis } from '@/lib/icTransfer/dealBookKpis';
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
  const { icRegions, icWarehouses, icSales, icPurchases } = useApp();
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
    if (!isBranchPortal) return filterWarehousesForAdminPortal(icWarehouses);
    return filterWarehousesForBranchPortal(icWarehouses, branchId!);
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

  const tradeBookKpis = useMemo(
    () => computeCombinedTradeBookKpis(scopedPurchases, scopedSales, range),
    [scopedPurchases, scopedSales, range],
  );

  const openAddWarehouseRef = useRef<(() => void) | null>(null);

  const addWarehouseButton = (
    <button
      type="button"
      className={`${asicBtnPrimary} !h-8 shrink-0 whitespace-nowrap`}
      onClick={() => openAddWarehouseRef.current?.()}
    >
      Add Warehouse
    </button>
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
    </PageShell>
  );
}
