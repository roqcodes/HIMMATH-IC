'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { notFound, useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import WarehouseModal from '@/components/ic-transfer/settings/WarehouseModal';
import { findWarehouseByRouteParam } from '@/lib/icTransfer/warehouseSlug';
import { computeSingleWarehouseMetrics } from '@/lib/icTransfer/warehouseMatrixMetrics';
import { computeCombinedTradeBookKpis } from '@/lib/icTransfer/dealBookKpis';
import WarehouseInventoryKpiGrid from '@/components/warehouse/WarehouseInventoryKpiGrid';
import WarehouseDetailTabs from '@/components/ic-transfer/warehouse/WarehouseDetailTabs';
import {
  getICTransferBranchDetailHref,
  getICTransferWarehouseBase,
  isBranchDeskWarehouse,
  type ICTransferPortalMode,
} from '@/lib/icTransfer/branchPortalScope';
import { resolveDateFilterRange, getDateFilterLabel } from '@/lib/dateFilterRange';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import ICTransferDateFilterBar from '@/components/ic-transfer/shared/ICTransferDateFilterBar';
import { useICTransferFilters } from '@/components/ic-transfer/ui';
import AddPurchaseModal from '@/components/ic-transfer/purchase/AddPurchaseModal';
import AddSaleModal from '@/components/ic-transfer/sales/AddSaleModal';
import { asicBtnOutline } from '@/components/asic/ui';
import PartyPaymentReceiptModal from '@/components/ic-transfer/shared/PartyPaymentReceiptModal';
import { useWriteAccess } from '@/context/RbacWriteContext';
import { formatStreetCityState } from '@/lib/geo/simpleAddress';

interface Props {
  branchSlug: string;
  warehouseId: string;
  portalMode?: ICTransferPortalMode;
}

const subtleTxnBtnBase =
  'inline-flex h-8 max-md:h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium shadow-surface-xs transition-colors disabled:pointer-events-none disabled:opacity-45';

const subtlePurchaseBtnClass = `${subtleTxnBtnBase} border-sky-200/90 bg-sky-50/70 text-sky-900 hover:border-sky-300 hover:bg-sky-100/80 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100 dark:hover:bg-sky-950/50`;

const subtleSaleBtnClass = `${subtleTxnBtnBase} border-emerald-200/90 bg-emerald-50/70 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100/80 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100 dark:hover:bg-emerald-950/50`;

export default function WarehouseDetailsClient({
  branchSlug,
  warehouseId,
  portalMode = 'admin',
}: Props) {
  const { icWarehouses, icRegions, icSales, icPurchases, icTransferSettings } = useApp();
  const { canWrite, buttonProps: wp } = useWriteAccess();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [prModal, setPrModal] = useState<'payment' | 'receipt' | null>(null);
  const [prRefreshToken, setPrRefreshToken] = useState(0);

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
        cashPurchaseInr: 0,
        metalPurchaseAed: 0,
        metalPurchaseInr: 0,
        cashSaleAed: 0,
        cashSaleInr: 0,
        metalSaleAed: 0,
        metalSaleInr: 0,
        cashGrossProfitAed: 0,
        cashGrossProfitInr: 0,
        metalProfitAed: 0,
        metalProfitInr: 0,
        metalStockInr: 0,
        icStockAvgAedRate: 0,
      };
    }
    return computeSingleWarehouseMetrics(warehouse, icRegions, icPurchases, icSales, range);
  }, [warehouse, icRegions, icPurchases, icSales, range]);

  const warehousePurchases = useMemo(
    () => (warehouse ? icPurchases.filter(p => p.warehouseId === warehouse.id) : []),
    [icPurchases, warehouse],
  );

  const warehouseSales = useMemo(
    () => (warehouse ? icSales.filter(s => s.warehouseId === warehouse.id) : []),
    [icSales, warehouse],
  );

  const tradeBookKpis = useMemo(
    () => computeCombinedTradeBookKpis(warehousePurchases, warehouseSales, range),
    [warehousePurchases, warehouseSales, range],
  );

  const purchaseBranchId =
    portalMode === 'branch' && warehouse?.branchId ? warehouse.branchId : undefined;

  const isBranchDesk = warehouse ? isBranchDeskWarehouse(warehouse) : false;

  useEffect(() => {
    if (warehouse && isBranchDesk) {
      router.replace(getICTransferBranchDetailHref(branchSlug, warehouse.id, portalMode));
    }
  }, [warehouse, isBranchDesk, branchSlug, portalMode, router]);

  const warehouseSubtitle = useMemo(() => {
    if (!warehouse) return undefined;
    const parts = [
      formatStreetCityState(warehouse.address, warehouse.indiaCity, warehouse.indiaState),
      warehouse.phone?.trim(),
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : undefined;
  }, [warehouse]);

  if (!warehouse && icWarehouses.length > 0) {
    return notFound();
  }

  if (!warehouse || isBranchDesk) return null;

  const warehouseListHref = getICTransferWarehouseBase(portalMode, branchSlug);

  const purchaseBlocked = !canWrite;
  const saleBlocked = !canWrite || salesPaused;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AsicPageHeader
        breadcrumbs={[{ label: 'Warehouses', href: warehouseListHref }, { label: warehouse.name }]}
        subtitle={warehouseSubtitle}
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
              onClick={canWrite ? () => setPrModal('receipt') : undefined}
              {...wp()}
            >
              Receipt
            </button>
            <button
              type="button"
              className={`${asicBtnOutline}${!canWrite ? ' cursor-not-allowed opacity-50' : ''}`}
              onClick={canWrite ? () => setPrModal('payment') : undefined}
              {...wp()}
            >
              Payment
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

      <WarehouseInventoryKpiGrid metrics={kpiMetrics} books={tradeBookKpis} rangeLabel={rangeLabel} />
      <WarehouseDetailTabs
        warehouseId={warehouse.id}
        range={range}
        portalMode={portalMode}
        branchSlug={branchSlug}
        purchaseBranchId={purchaseBranchId}
        refreshToken={prRefreshToken}
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
        branchId={purchaseBranchId}
        warehouses={warehouse ? [warehouse] : undefined}
        lockedWarehouseId={warehouse.id}
      />

      {prModal ? (
        <PartyPaymentReceiptModal
          open
          mode={{ book: 'INR', warehouse }}
          voucherType={prModal}
          onClose={() => setPrModal(null)}
          onSaved={() => setPrRefreshToken(t => t + 1)}
        />
      ) : null}
    </div>
  );
}
