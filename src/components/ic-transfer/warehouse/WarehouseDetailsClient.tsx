'use client';

import React, { useMemo, useState } from 'react';
import { notFound } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import WarehouseUsersManagement from '@/components/ic-transfer/settings/WarehouseUsersManagement';
import WarehouseModal from '@/components/ic-transfer/settings/WarehouseModal';
import { CognitoUser } from '@/app/actions/cognitoActions';
import { findWarehouseByRouteParam } from '@/lib/icTransfer/warehouseSlug';
import { computeSingleWarehouseMetrics } from '@/lib/icTransfer/warehouseMatrixMetrics';
import {
  getICTransferWarehouseBase,
  type ICTransferPortalMode,
} from '@/lib/icTransfer/branchPortalScope';
import { resolveDateFilterRange, getDateFilterLabel } from '@/lib/dateFilterRange';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import WarehouseKpiGrid from '@/components/warehouse/WarehouseKpiGrid';
import ICTransferDateFilterBar from '@/components/ic-transfer/shared/ICTransferDateFilterBar';
import { useICTransferFilters } from '@/components/ic-transfer/ui';
import AddPurchaseModal from '@/components/ic-transfer/purchase/AddPurchaseModal';
import AddSaleModal from '@/components/ic-transfer/sales/AddSaleModal';
import { asicBtnOutline, asicCard, asicFormGridLoose } from '@/components/asic/ui';
import { useWriteAccess } from '@/context/RbacWriteContext';

interface Props {
  branchSlug: string;
  warehouseId: string;
  initialUsers: CognitoUser[];
  usersError?: string;
  portalMode?: ICTransferPortalMode;
}

const subtleTxnBtnBase =
  'inline-flex h-8 max-md:h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium shadow-surface-xs transition-colors disabled:pointer-events-none disabled:opacity-45';

const subtlePurchaseBtnClass = `${subtleTxnBtnBase} border-sky-200/90 bg-sky-50/70 text-sky-900 hover:border-sky-300 hover:bg-sky-100/80 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100 dark:hover:bg-sky-950/50`;

const subtleSaleBtnClass = `${subtleTxnBtnBase} border-emerald-200/90 bg-emerald-50/70 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100/80 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100 dark:hover:bg-emerald-950/50`;

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
  initialUsers,
  usersError,
  portalMode = 'admin',
}: Props) {
  const { icWarehouses, icRegions, icSales, icTransferSettings } = useApp();
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

  const scopedSales = useMemo(() => icSales, [icSales]);

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
        reserved: 0,
        remaining: 0,
        totalOrders: 0,
        totalCompleted: 0,
        totalPending: 0,
        splitOrders: 0,
        deliveredUnits: 0,
        remainingUnits: 0,
      };
    }
    return computeSingleWarehouseMetrics(warehouse, icRegions, scopedSales, range);
  }, [warehouse, icRegions, scopedSales, range]);

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

      <WarehouseKpiGrid metrics={kpiMetrics} showSplit showCompleted />

      <div className={`${asicCard} mb-3`}>
        <div className="border-b border-slate-100 px-3 py-2.5 sm:px-4">
          <h3 className="text-sm font-semibold text-slate-900">Stock & profile · {rangeLabel}</h3>
        </div>
        <div className={`${asicFormGridLoose} p-3 sm:p-4`}>
          <DetailRow
            label="Current stock (units)"
            value={
              <span className={(warehouse.currentStock ?? 0) < 0 ? 'font-semibold text-red-600' : 'font-semibold tabular-nums'}>
                {(warehouse.currentStock ?? 0).toLocaleString('en-US', { maximumFractionDigits: 4 })}
              </span>
            }
          />
          <DetailRow
            label="Metal on hand"
            value={
              <span className="font-semibold tabular-nums">
                {(warehouse.currentMetalG ?? 0).toLocaleString('en-US', { maximumFractionDigits: 4 })} g
              </span>
            }
          />
          <DetailRow label="Reserved" value={<span className="font-semibold tabular-nums text-amber-700">{kpiMetrics.reserved.toLocaleString()}</span>} />
          <DetailRow label="Available" value={<span className="font-semibold tabular-nums text-emerald-700">{kpiMetrics.remaining.toLocaleString()}</span>} />
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

      <WarehouseUsersManagement
        embedded
        initialUsers={initialUsers}
        error={usersError}
        warehouseId={warehouse.id}
        branchSlug={branchSlug}
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
