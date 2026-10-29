'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { asicBtnGhost } from '@/components/asic/ui';
import SalesTableShell, {
  salesTableClass,
  salesTableEmptyClass,
  salesTableRowInteractiveClass,
  salesTableTdClass,
  salesTableTdLabelClass,
  salesTableThClass,
  salesTableTheadRowClass,
} from '@/components/ic-transfer/shared/SalesTableShell';
import AddUserModal from '@/components/ic-transfer/settings/AddUserModal';
import { useApp } from '@/context/AppContext';
import type { ICWarehouse } from '@/types';
import { ConfirmModal } from '@/components/warehouse/shared';
import {
  getICTransferWarehouseDetailHref,
  type ICTransferPortalMode,
} from '@/lib/icTransfer/branchPortalScope';
import { parseAsicPath } from '@/lib/asic/routing';

type Props = {
  portalMode?: ICTransferPortalMode;
  branchId?: string;
  warehouses: ICWarehouse[];
  registerOpenAdd?: (openAdd: (() => void) | null) => void;
};

export default function ManageWarehousesSection({
  portalMode = 'admin',
  branchId,
  warehouses,
  registerOpenAdd,
}: Props) {
  const { icRegions, addICWarehouse, updateICWarehouse, deleteICWarehouse } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  const [formOpen, setFormOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<ICWarehouse | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const workspace = useMemo(() => {
    const parsed = parseAsicPath(pathname);
    if (parsed.portal === 'admin-root') {
      return { mode: 'admin' as ICTransferPortalMode, slug: undefined };
    }
    if (parsed.portal === 'branch' && parsed.branchSlug) {
      return { mode: 'branch' as ICTransferPortalMode, slug: parsed.branchSlug };
    }
    const legacySlug = params.slug as string | undefined;
    return { mode: portalMode, slug: legacySlug };
  }, [pathname, params.slug, portalMode]);

  const sortedWarehouses = useMemo(
    () => [...warehouses].sort((a, b) => a.name.localeCompare(b.name)),
    [warehouses],
  );

  const regionName = (regionId?: string) =>
    icRegions.find(r => r.id === regionId)?.name ?? '—';

  const openAdd = useCallback(() => {
    setEditingWarehouse(null);
    setFormOpen(true);
  }, []);

  useEffect(() => {
    registerOpenAdd?.(openAdd);
    return () => registerOpenAdd?.(null);
  }, [registerOpenAdd, openAdd]);

  const openEdit = (warehouse: ICWarehouse) => {
    setEditingWarehouse(warehouse);
    setFormOpen(true);
  };

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
    if (data.id) {
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
    } else {
      await addICWarehouse(
        data.name,
        data.phone,
        data.commission,
        '',
        data.email,
        data.address,
        data.sendDeliveryProofToCustomer,
        branchId ?? null,
      );
    }
    setFormOpen(false);
    setEditingWarehouse(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    setDeleteLoading(true);
    await deleteICWarehouse(deleteTargetId);
    setDeleteLoading(false);
    setDeleteTargetId(null);
  };

  const openUsers = (warehouseId: string) => {
    const href = getICTransferWarehouseDetailHref(workspace.slug ?? '', warehouseId, workspace.mode);
    router.push(href);
  };

  return (
    <>
      <ConfirmModal
        open={!!deleteTargetId}
        title="Delete Warehouse"
        message="Are you sure you want to delete this warehouse? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTargetId(null)}
      />

      <div className="mb-3">
        <SalesTableShell title="Warehouses">
          <table className={`${salesTableClass} min-w-[880px]`}>
            <thead>
              <tr className={salesTableTheadRowClass}>
                {['Name', 'Region', 'Phone', 'Email', 'Delivery proof', 'Actions'].map(col => (
                  <th key={col} className={salesTableThClass}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedWarehouses.length === 0 ? (
                <tr>
                  <td colSpan={6} className={salesTableEmptyClass}>
                    No warehouses configured yet.
                  </td>
                </tr>
              ) : (
                sortedWarehouses.map(warehouse => {
                  const href = getICTransferWarehouseDetailHref(workspace.slug ?? '', warehouse.id, workspace.mode);
                  return (
                    <tr
                      key={warehouse.id}
                      className={salesTableRowInteractiveClass}
                      onClick={() => openUsers(warehouse.id)}
                    >
                      <td className={salesTableTdLabelClass}>
                        <Link
                          href={href}
                          className="hover:text-accent"
                          onClick={e => e.stopPropagation()}
                        >
                          {warehouse.name}
                        </Link>
                      </td>
                      <td className={salesTableTdClass}>{regionName(warehouse.regionId)}</td>
                      <td className={salesTableTdClass}>{warehouse.phone || '—'}</td>
                      <td className={salesTableTdClass}>{warehouse.email || '—'}</td>
                      <td className={salesTableTdClass}>
                        {warehouse.sendDeliveryProofToCustomer === false
                          ? 'Admin verifies'
                          : 'Customer verifies'}
                      </td>
                      <td className={salesTableTdClass}>
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            className={asicBtnGhost}
                            onClick={e => {
                              e.stopPropagation();
                              openUsers(warehouse.id);
                            }}
                          >
                            View & users
                          </button>
                          <button
                            type="button"
                            className={asicBtnGhost}
                            onClick={e => {
                              e.stopPropagation();
                              openEdit(warehouse);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`${asicBtnGhost} text-red-600 hover:text-red-700`}
                            onClick={e => {
                              e.stopPropagation();
                              setDeleteTargetId(warehouse.id);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </SalesTableShell>
      </div>

      <AddUserModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingWarehouse(null);
        }}
        title={editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse'}
        showCommission={false}
        showDeliveryProofToggle
        showRate={false}
        showPassword={false}
        showRegion={false}
        initialData={editingWarehouse}
        onAdd={handleSave}
      />
    </>
  );
}
