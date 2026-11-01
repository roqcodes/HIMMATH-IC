'use client';

import React, { useMemo, useState } from 'react';
import { notFound } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import WarehouseModal from '@/components/ic-transfer/settings/WarehouseModal';
import { findWarehouseByRouteParam } from '@/lib/icTransfer/warehouseSlug';
import { computeSingleWarehouseMetrics, formatMetalGrams } from '@/lib/icTransfer/warehouseMatrixMetrics';
import { warehouseTotalProfitAed } from '@/lib/icTransfer/warehouseActivity';
import WarehouseDetailTabs from '@/components/ic-transfer/warehouse/WarehouseDetailTabs';
import {
  getICTransferWarehouseBase,
  type ICTransferPortalMode,
} from '@/lib/icTransfer/branchPortalScope';
import { resolveDateFilterRange, getDateFilterLabel } from '@/lib/dateFilterRange';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import ICTransferDateFilterBar from '@/components/ic-transfer/shared/ICTransferDateFilterBar';
import { useICTransferFilters } from '@/components/ic-transfer/ui';
import AddPurchaseModal from '@/components/ic-transfer/purchase/AddPurchaseModal';
import AddSaleModal from '@/components/ic-transfer/sales/AddSaleModal';
import { asicBtnOutline, asicCard, asicFormGridLoose } from '@/components/asic/ui';
import { useWriteAccess } from '@/context/RbacWriteContext';

interface Props {
  branchSlug: string;
  warehouseId: string;
  portalMode?: ICTransferPortalMode;
}

const subtleTxnBtnBase =
  'inline-flex h-8 max-md:h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium shadow-surface-xs transition-colors disabled:pointer-events-none disabled:opacity-45';

const subtlePurchaseBtnClass = `${subtleTxnBtnBase} border-sky-200/90 bg-sky-50/70 text-sky-900 hover:border-sky-300 hover:bg-sky-100/80 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100 dark:hover:bg-sky-950/50`;

const subtleSaleBtnClass = `${subtleTxnBtnBase} border-emerald-200/90 bg-emerald-50/70 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100/80 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100 dark:hover:bg-emerald-950/50`;

function fmtKpiAed(n: number): string {
  return `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dealCountHint(count: number, rangeLabel: string): string {
  return `${count} ${count === 1 ? 'deal' : 'deals'} · ${rangeLabel}`;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm text-slate-900">{value}</p>
    </div>
  );
}

export default function WarehouseDetailsClient({
  branchSlug,
  warehouseId,
  portalMode = 'admin',
}: Props) {
  const { icWarehouses, icRegions, icSales, icPurchases, icTransferSettings } = useApp();
  const { canWrite, buttonProps: wp } = useWriteAccess();
  const [editOpen, setEditOpen] = useState(false);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [saleModalOpen, setSaleModalOpen] = useState(false);

  const salesPaused = !icTransferSettings.salesEnabled;

  const {
    dateFilter,
    setDateFilter,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
  } = useICTransferFilters();

  const warehouse = useMemo(
    () => findWarehouseByRouteParam(icWarehouses, warehouseId),
    [icWarehouses, warehouseId],
  );

  const range = useMemo(
    () => resolveDateFilterRange(dateFilter, customStartDate, customEndDate),
    [dateFilter, customStartDate, customEndDate],
  );

  const rangeLabel = useMemo(
    () => getDateFilterLabel(dateFilter, customStartDate, customEndDate),
    [dateFilter, customStartDate, customEndDate],
  );

  const kpiMetrics = useMemo(() => {
    if (!warehouse) {
      return {
        currentStock: 0,
        currentMetalG: 0,
        cashPurchases: 0,
        metalPurchases: 0,
        cashSales: 0,
        metalSales: 0,
        cashPurchaseAed: 0,
        metalPurchaseAed: 0,
        cashSaleAed: 0,
        metalSaleAed: 0,
        cashGrossProfitAed: 0,
        metalProfitAed: 0,
        metalProfitInr: 0,
      };
    }
    return computeSingleWarehouseMetrics(warehouse, icRegions, icPurchases, icSales, range);
  }, [warehouse, icRegions, icPurchases, icSales, range]);

  const totalProfitAed = useMemo(
    () => warehouseTotalProfitAed(kpiMetrics.cashGrossProfitAed, kpiMetrics.metalProfitAed),
    [kpiMetrics.cashGrossProfitAed, kpiMetrics.metalProfitAed],
  );

  const purchaseBranchId =
    portalMode === 'branch' && warehouse?.branchId ? warehouse.branchId : undefined;

  if (!warehouse && icWarehouses.length > 0) {
    return notFound();
  }

  if (!warehouse) return null;

  const warehouseListHref = getICTransferWarehouseBase(portalMode, branchSlug);
  const indiaLocationLabel = [warehouse.indiaCity, warehouse.indiaState].filter(Boolean).join(', ') || '—';

  const purchaseBlocked = !canWrite;
  const saleBlocked = !canWrite || salesPaused;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AsicPageHeader
        breadcrumbs={[
          { label: 'Warehouses', href: warehouseListHref },
          { label: warehouse.name },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`${subtlePurchaseBtnClass}${purchaseBlocked ? ' cursor-not-allowed' : ''}`}
              onClick={purchaseBlocked ? undefined : () => setPurchaseModalOpen(true)}
              aria-label="Add purchase for this warehouse"
              {...wp({ disabled: purchaseBlocked })}
            >
              Add purchase
            </button>
            <button
              type="button"
              className={`${subtleSaleBtnClass}${saleBlocked ? ' cursor-not-allowed' : ''}`}
              onClick={saleBlocked ? undefined : () => setSaleModalOpen(true)}
              aria-label="Add sale for this warehouse"
              {...wp({ disabled: saleBlocked })}
            >
              Add sale
            </button>
            <button
              type="button"
              className={`${asicBtnOutline}${!canWrite ? ' cursor-not-allowed opacity-50' : ''}`}
              onClick={canWrite ? () => setEditOpen(true) : undefined}
              {...wp()}
            >
              Edit warehouse
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

      <AsicKpiStrip
        metrics={[
          {
            label: 'Stock (units)',
            value: kpiMetrics.currentStock.toLocaleString('en-US', { maximumFractionDigits: 4 }),
            hint: 'On hand',
          },
          {
            label: 'IC purchases',
            value: fmtKpiAed(kpiMetrics.cashPurchaseAed),
            hint: dealCountHint(kpiMetrics.cashPurchases, rangeLabel),
          },
          {
            label: 'IC sales',
            value: fmtKpiAed(kpiMetrics.cashSaleAed),
            hint: dealCountHint(kpiMetrics.cashSales, rangeLabel),
            tone: 'emerald',
          },
          {
            label: 'Metal on hand',
            value: formatMetalGrams(kpiMetrics.currentMetalG),
            hint: 'Available gold',
            tone: 'amber',
          },
          {
            label: 'Metal purchases',
            value: fmtKpiAed(kpiMetrics.metalPurchaseAed),
            hint: dealCountHint(kpiMetrics.metalPurchases, rangeLabel),
            tone: 'indigo',
          },
          {
            label: 'Metal sales',
            value: fmtKpiAed(kpiMetrics.metalSaleAed),
            hint: dealCountHint(kpiMetrics.metalSales, rangeLabel),
            tone: 'amber',
          },
          {
            label: 'IC profit',
            value: fmtKpiAed(kpiMetrics.cashGrossProfitAed),
            hint: 'WAC on IC sales',
            tone: kpiMetrics.cashGrossProfitAed >= 0 ? 'emerald' : 'red',
          },
          {
            label: 'Metal profit',
            value: fmtKpiAed(kpiMetrics.metalProfitAed),
            hint: 'Sale − purchase AED',
            tone: kpiMetrics.metalProfitAed >= 0 ? 'emerald' : 'red',
          },
          {
            label: 'Total profit',
            value: fmtKpiAed(totalProfitAed),
            hint: rangeLabel,
            tone: totalProfitAed >= 0 ? 'emerald' : 'red',
          },
        ]}
        columns={3}
      />

      <div className={`${asicCard} mb-3`}>
        <div className="border-b border-slate-100 px-3 py-2.5 sm:px-4">
          <h3 className="text-sm font-semibold text-slate-900">Profile</h3>
        </div>
        <div className={`${asicFormGridLoose} p-3 sm:p-4`}>
          <DetailRow label="Location (India)" value={indiaLocationLabel} />
          <DetailRow label="Phone" value={warehouse.phone || '—'} />
          <DetailRow label="Email" value={warehouse.email || '—'} />
          <DetailRow
            label="Address"
            value={
              warehouse.address ? (
                <span className="line-clamp-3" title={warehouse.address}>
                  {warehouse.address}
                </span>
              ) : (
                '—'
              )
            }
          />
          <DetailRow
            label="Commission"
            value={warehouse.commission != null ? `${warehouse.commission}%` : '—'}
          />
        </div>
      </div>

      <WarehouseDetailTabs
        warehouseId={warehouse.id}
        range={range}
        portalMode={portalMode}
        branchSlug={branchSlug}
        purchaseBranchId={purchaseBranchId}
      />

      <WarehouseModal
        open={editOpen}
        warehouse={warehouse}
        onClose={() => setEditOpen(false)}
        onSaved={() => setEditOpen(false)}
      />

      <AddPurchaseModal
        open={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        branchId={purchaseBranchId}
        warehouses={[warehouse]}
        lockedWarehouseId={warehouse.id}
      />
      <AddSaleModal
        open={saleModalOpen}
        onClose={() => setSaleModalOpen(false)}
        lockedWarehouseId={warehouse.id}
      />
    </div>
  );
}
