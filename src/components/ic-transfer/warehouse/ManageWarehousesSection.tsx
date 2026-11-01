'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { asicBtnGhost } from '@/components/asic/ui';
import ICTransferDataTableShell, {
  ICTransferTableFilterSelect,
  icTdClass,
  type ICTransferTableColumn,
} from '@/components/ic-transfer/shared/ICTransferDataTableShell';
import WarehouseModal from '@/components/ic-transfer/settings/WarehouseModal';
import { useApp } from '@/context/AppContext';
import type { ICWarehouse } from '@/types';
import { ConfirmModal } from '@/components/warehouse/shared';
import {
  getICTransferWarehouseDetailHref,
  type ICTransferPortalMode,
} from '@/lib/icTransfer/branchPortalScope';
import { parseAsicPath } from '@/lib/asic/routing';

const WAREHOUSE_TABLE_COLUMNS: ICTransferTableColumn[] = [
  { id: 'Name', label: 'Name', align: 'left' },
  { id: 'Location', label: 'Location (India)', align: 'left' },
  { id: 'Phone', label: 'Phone', align: 'left' },
  { id: 'Email', label: 'Email', align: 'left' },
  { id: 'Actions', label: 'Actions', align: 'center', sortable: false },
];

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
  const { deleteICWarehouse } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  const [formOpen, setFormOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<ICWarehouse | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('All');
  const [filterHasEmail, setFilterHasEmail] = useState<'All' | 'yes' | 'no'>('All');
  const [sortField, setSortField] = useState('Name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

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

  const formatIndiaLocation = (warehouse: ICWarehouse) => {
    const parts = [warehouse.indiaCity, warehouse.indiaState].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '—';
  };

  const stateOptions = useMemo(() => {
    const states = new Set<string>();
    for (const w of warehouses) {
      const s = w.indiaState?.trim();
      if (s) states.add(s);
    }
    return [...states].sort((a, b) => a.localeCompare(b));
  }, [warehouses]);

  const filteredWarehouses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return warehouses.filter(w => {
      if (filterState !== 'All') {
        const state = w.indiaState?.trim() || '';
        if (state !== filterState) return false;
      }
      if (filterHasEmail === 'yes' && !w.email?.trim()) return false;
      if (filterHasEmail === 'no' && w.email?.trim()) return false;
      if (!q) return true;
      const haystack = [
        w.name,
        w.phone,
        w.email,
        w.indiaCity,
        w.indiaState,
        formatIndiaLocation(w),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [warehouses, search, filterState, filterHasEmail]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedWarehouses = useMemo(() => {
    const sorted = [...filteredWarehouses];
    sorted.sort((a, b) => {
      let valA: string;
      let valB: string;
      switch (sortField) {
        case 'Location':
          valA = formatIndiaLocation(a);
          valB = formatIndiaLocation(b);
          break;
        case 'Phone':
          valA = a.phone || '';
          valB = b.phone || '';
          break;
        case 'Email':
          valA = a.email || '';
          valB = b.email || '';
          break;
        case 'Name':
        default:
          valA = a.name;
          valB = b.name;
          break;
      }
      const cmp = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredWarehouses, sortField, sortOrder]);

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

  const closeModal = () => {
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

  const openDetail = (warehouseId: string) => {
    const href = getICTransferWarehouseDetailHref(workspace.slug ?? '', warehouseId, workspace.mode);
    router.push(href);
  };

  const tableEmpty =
    warehouses.length === 0
      ? 'No warehouses configured yet.'
      : 'No warehouses match your search or filters.';

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

      <div className="mb-3 min-h-0 flex-1">
        <ICTransferDataTableShell
          title="Warehouses"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, location, phone, email…"
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={handleSort}
          columns={WAREHOUSE_TABLE_COLUMNS}
          isEmpty={sortedWarehouses.length === 0}
          emptyMessage={tableEmpty}
          filters={
            <>
              <ICTransferTableFilterSelect
                value={filterState}
                onChange={setFilterState}
                aria-label="Filter by state"
              >
                <option value="All">All states</option>
                {stateOptions.map(state => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </ICTransferTableFilterSelect>
              <ICTransferTableFilterSelect
                value={filterHasEmail}
                onChange={v => setFilterHasEmail(v as 'All' | 'yes' | 'no')}
                aria-label="Filter by email"
              >
                <option value="All">All email</option>
                <option value="yes">Has email</option>
                <option value="no">No email</option>
              </ICTransferTableFilterSelect>
            </>
          }
        >
          {sortedWarehouses.map(warehouse => {
            const href = getICTransferWarehouseDetailHref(
              workspace.slug ?? '',
              warehouse.id,
              workspace.mode,
            );
            return (
              <tr
                key={warehouse.id}
                className="cursor-pointer border-b border-slate-100 hover:bg-slate-50/80"
                onClick={() => openDetail(warehouse.id)}
              >
                <td className={`${icTdClass('left')} font-medium text-slate-900`}>
                  <Link
                    href={href}
                    className="hover:text-accent"
                    onClick={e => e.stopPropagation()}
                  >
                    {warehouse.name}
                  </Link>
                </td>
                <td className={icTdClass('left')}>{formatIndiaLocation(warehouse)}</td>
                <td className={icTdClass('left')}>{warehouse.phone || '—'}</td>
                <td className={icTdClass('left')}>{warehouse.email || '—'}</td>
                <td className={icTdClass('center')}>
                  <div className="flex flex-wrap items-center justify-center gap-1">
                    <button
                      type="button"
                      className={asicBtnGhost}
                      onClick={e => {
                        e.stopPropagation();
                        openDetail(warehouse.id);
                      }}
                    >
                      View
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
          })}
        </ICTransferDataTableShell>
      </div>

      <WarehouseModal
        open={formOpen}
        warehouse={editingWarehouse}
        branchId={branchId ?? null}
        onClose={closeModal}
        onSaved={closeModal}
      />
    </>
  );
}
