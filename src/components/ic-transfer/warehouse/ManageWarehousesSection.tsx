'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import ICTransferDataTableShell, {
  icTdClass,
  type ICTransferTableColumn,
} from '@/components/ic-transfer/shared/ICTransferDataTableShell';
import WarehouseModal from '@/components/ic-transfer/settings/WarehouseModal';
import type { ICWarehouse } from '@/types';
import {
  getICTransferWarehouseDetailHref,
  type ICTransferPortalMode,
} from '@/lib/icTransfer/branchPortalScope';
import { parseAsicPath } from '@/lib/asic/routing';
import {
  WAREHOUSE_MATRIX_COLUMNS,
  matrixRowToCells,
  type WarehouseMatrixRow,
} from '@/lib/icTransfer/warehouseMatrixMetrics';

const LIST_COLUMNS: ICTransferTableColumn[] = [
  { id: 'Name', label: 'Warehouse', align: 'left' },
  ...WAREHOUSE_MATRIX_COLUMNS.map(label => ({
    id: label,
    label,
    align: 'right' as const,
  })),
];

type Props = {
  portalMode?: ICTransferPortalMode;
  branchId?: string;
  warehouses: ICWarehouse[];
  matrixRows: WarehouseMatrixRow[];
  rangeLabel: string;
  registerOpenAdd?: (openAdd: (() => void) | null) => void;
};

function emptyMatrixRow(warehouse: ICWarehouse): WarehouseMatrixRow {
  return {
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    regionName: '',
    currentStock: Number(warehouse.currentStock ?? 0),
    currentMetalG: Number(warehouse.currentMetalG ?? 0),
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

export default function ManageWarehousesSection({
  portalMode = 'admin',
  branchId,
  warehouses,
  matrixRows,
  rangeLabel,
  registerOpenAdd,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState('');
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

  const matrixById = useMemo(() => {
    const map = new Map<string, WarehouseMatrixRow>();
    for (const row of matrixRows) map.set(row.warehouseId, row);
    return map;
  }, [matrixRows]);

  const filteredWarehouses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return warehouses;
    return warehouses.filter(w => w.name.toLowerCase().includes(q));
  }, [warehouses, search]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'Name' ? 'asc' : 'desc');
    }
  };

  const sortedWarehouses = useMemo(() => {
    const sorted = [...filteredWarehouses];
    sorted.sort((a, b) => {
      const rowA = matrixById.get(a.id) ?? emptyMatrixRow(a);
      const rowB = matrixById.get(b.id) ?? emptyMatrixRow(b);
      let cmp = 0;
      switch (sortField) {
        case 'IC stock':
          cmp = rowA.currentStock - rowB.currentStock;
          break;
        case 'Metal (g)':
          cmp = rowA.currentMetalG - rowB.currentMetalG;
          break;
        case 'IC purchases':
          cmp = rowA.cashPurchases - rowB.cashPurchases;
          break;
        case 'Metal purchases':
          cmp = rowA.metalPurchases - rowB.metalPurchases;
          break;
        case 'IC sales':
          cmp = rowA.cashSales - rowB.cashSales;
          break;
        case 'Metal sales':
          cmp = rowA.metalSales - rowB.metalSales;
          break;
        case 'IC P&L':
          cmp = rowA.cashGrossProfitAed - rowB.cashGrossProfitAed;
          break;
        case 'Metal P&L':
          cmp = rowA.metalProfitAed - rowB.metalProfitAed;
          break;
        case 'Name':
        default:
          cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredWarehouses, sortField, sortOrder, matrixById]);

  const openAdd = useCallback(() => {
    setFormOpen(true);
  }, []);

  useEffect(() => {
    registerOpenAdd?.(openAdd);
    return () => registerOpenAdd?.(null);
  }, [registerOpenAdd, openAdd]);

  const openDetail = (warehouseId: string) => {
    const href = getICTransferWarehouseDetailHref(workspace.slug ?? '', warehouseId, workspace.mode);
    router.push(href);
  };

  const tableEmpty =
    warehouses.length === 0
      ? 'No warehouses configured yet.'
      : 'No warehouses match your search.';

  return (
    <>
      <div className="mb-3 min-h-0 flex-1">
        <ICTransferDataTableShell
          title={`Warehouses · ${rangeLabel}`}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search warehouse…"
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={handleSort}
          columns={LIST_COLUMNS}
          isEmpty={sortedWarehouses.length === 0}
          emptyMessage={tableEmpty}
        >
          {sortedWarehouses.map(warehouse => {
            const href = getICTransferWarehouseDetailHref(
              workspace.slug ?? '',
              warehouse.id,
              workspace.mode,
            );
            const matrix = matrixById.get(warehouse.id) ?? emptyMatrixRow(warehouse);
            const cells = matrixRowToCells(matrix);
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
                {cells.map((cell, j) => (
                  <td key={j} className={`${icTdClass('right')} font-mono tabular-nums text-slate-800`}>
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </ICTransferDataTableShell>
      </div>

      <WarehouseModal
        open={formOpen}
        warehouse={null}
        branchId={branchId ?? null}
        onClose={() => setFormOpen(false)}
        onSaved={() => setFormOpen(false)}
      />
    </>
  );
}
