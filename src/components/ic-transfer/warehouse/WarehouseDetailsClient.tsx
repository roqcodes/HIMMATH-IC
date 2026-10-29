'use client';

import React, { useMemo, useState } from 'react';
import { notFound } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import WarehouseUsersManagement from '@/components/ic-transfer/settings/WarehouseUsersManagement';
import AddUserModal from '@/components/ic-transfer/settings/AddUserModal';
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
import { asicBtnOutline, asicCard, asicFormGridLoose } from '@/components/asic/ui';
import { useWriteAccess } from '@/context/RbacWriteContext';

interface Props {
  branchSlug: string;
  warehouseId: string;
  initialUsers: CognitoUser[];
  usersError?: string;
  portalMode?: ICTransferPortalMode;
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
  initialUsers,
  usersError,
  portalMode = 'admin',
}: Props) {
  const { icWarehouses, icRegions, icSales, updateICWarehouse } = useApp();
  const { canWrite, buttonProps: wp } = useWriteAccess();
  const [editOpen, setEditOpen] = useState(false);

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

  if (!warehouse && icWarehouses.length > 0) {
    return notFound();
  }

  if (!warehouse) return null;

  const regionName = icRegions.find(r => r.id === warehouse.regionId)?.name || '—';
  const warehouseListHref = getICTransferWarehouseBase(portalMode, branchSlug);
  const deliveryProofLabel =
    warehouse.sendDeliveryProofToCustomer === false
      ? 'Admin verifies delivery'
      : 'Customer verifies delivery';

  const handleSave = async (data: {
    id?: string;
    name: string;
    phone: string;
    commission: number | null;
    regionId: string;
    email: string;
    address: string;
    sendDeliveryProofToCustomer?: boolean;
  }) => {
    if (!data.id) return;
    await updateICWarehouse(
      data.id,
      data.name,
      data.phone,
      data.commission,
      '',
      data.email,
      data.address,
      data.sendDeliveryProofToCustomer,
    );
    setEditOpen(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AsicPageHeader
        breadcrumbs={[
          { label: 'Warehouses', href: warehouseListHref },
          { label: warehouse.name },
        ]}
        actions={
          <button
            type="button"
            className={`${asicBtnOutline}${!canWrite ? ' cursor-not-allowed opacity-50' : ''}`}
            onClick={canWrite ? () => setEditOpen(true) : undefined}
            {...wp()}
          >
            Edit warehouse
          </button>
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
            label="Current stock"
            value={
              <span className={(warehouse.currentStock ?? 0) < 0 ? 'font-semibold text-red-600' : 'font-semibold tabular-nums'}>
                {(warehouse.currentStock ?? 0).toLocaleString('en-US', { maximumFractionDigits: 4 })}
              </span>
            }
          />
          <DetailRow label="Reserved" value={<span className="font-semibold tabular-nums text-amber-700">{kpiMetrics.reserved.toLocaleString()}</span>} />
          <DetailRow label="Available" value={<span className="font-semibold tabular-nums text-emerald-700">{kpiMetrics.remaining.toLocaleString()}</span>} />
          <DetailRow label="Region" value={regionName} />
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
          <DetailRow label="Delivery proof" value={deliveryProofLabel} />
        </div>
      </div>

      <WarehouseUsersManagement
        embedded
        initialUsers={initialUsers}
        error={usersError}
        warehouseId={warehouse.id}
        branchSlug={branchSlug}
      />

      <AddUserModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Warehouse"
        showCommission={false}
        showDeliveryProofToggle
        showRate={false}
        showPassword={false}
        showRegion={false}
        initialData={warehouse}
        onAdd={handleSave}
      />
    </div>
  );
}
