'use client';

import React, { useMemo, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { asicBtnPrimary } from '@/components/asic/ui';
import { resolveDateFilterRange, getDateFilterLabel } from '@/lib/dateFilterRange';
import {
  computeWarehouseMatrix,
  matrixRowToCells,
  WAREHOUSE_MATRIX_COLUMNS,
} from '@/lib/icTransfer/warehouseMatrixMetrics';
import {
  filterSalesForBranchPortal,
  filterWarehousesForBranchPortal,
  filterWarehousesForAdminPortal,
  type ICTransferPortalMode,
} from '@/lib/icTransfer/branchPortalScope';
import WarehouseKpiGrid from '@/components/warehouse/WarehouseKpiGrid';
import ManageWarehousesSection from '@/components/ic-transfer/warehouse/ManageWarehousesSection';
import ICTransferDateFilterBar from '@/components/ic-transfer/shared/ICTransferDateFilterBar';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import { useICTransferRegionFilter } from '@/components/ic-transfer/shared/ICTransferFilterProvider';
import SalesTableShell, {
  salesTableClass,
  salesTableEmptyClass,
  salesTableTdClass,
  salesTableTdLabelClass,
  salesTableThClass,
  salesTableTheadRowClass,
} from '@/components/ic-transfer/shared/SalesTableShell';
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
  const { icRegions, icWarehouses, icSales } = useApp();
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
        sales: scopedSales,
        range,
        regionIds: selectedRegionIds.length > 0 ? selectedRegionIds : undefined,
      }),
    [scopedWarehouses, icRegions, scopedSales, range, selectedRegionIds],
  );

  const kpiMetrics = useMemo(
    () => ({
      currentStock: totals.currentStock,
      reserved: totals.reserved,
      remaining: totals.remaining,
      totalOrders: totals.totalOrders,
      totalCompleted: totals.totalCompleted,
      totalPending: totals.totalPending,
      splitOrders: totals.splitOrders,
    }),
    [totals],
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

      <WarehouseKpiGrid
        metrics={kpiMetrics}
        showSplit={false}
        showCompleted={false}
        deliveredUnits={totals.deliveredUnits}
        remainingUnits={totals.remainingUnits}
      />

      <div className="mb-3">
        <SalesTableShell title={`Warehouse Matrix · ${rangeLabel}`}>
          <table className={`${salesTableClass} min-w-[960px]`}>
            <thead>
              <tr className={salesTableTheadRowClass}>
                {['Warehouse', ...WAREHOUSE_MATRIX_COLUMNS].map(col => (
                  <th key={col} className={salesTableThClass}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={WAREHOUSE_MATRIX_COLUMNS.length + 1} className={salesTableEmptyClass}>
                    {isBranchPortal
                      ? 'No branch warehouses yet. Add one below.'
                      : 'No warehouses match the selected regions.'}
                  </td>
                </tr>
              ) : (
                rows.map(row => (
                  <tr key={row.warehouseId} className="border-b border-slate-100 transition-colors hover:bg-slate-50/80">
                    <td className={salesTableTdLabelClass}>{row.warehouseName}</td>
                    {matrixRowToCells(row).map((cell, j) => (
                      <td key={j} className={salesTableTdClass}>{cell}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </SalesTableShell>
      </div>

      <ManageWarehousesSection
        portalMode={portalMode}
        branchId={isBranchPortal ? branchId : undefined}
        warehouses={scopedWarehouses}
        registerOpenAdd={fn => {
          openAddWarehouseRef.current = fn;
        }}
      />
    </PageShell>
  );
}
