import { query } from '@/lib/db';
import { mapICWarehouseRow } from '@/lib/icTransferMappers';
import type { ICWarehouse } from '@/types';
import { isFullWarehouseUuid, warehouseShortSlug } from '@/lib/icTransfer/warehouseSlug';

export async function fetchWarehouseByRouteParam(param: string): Promise<ICWarehouse | null> {
  if (!param) return null;

  if (isFullWarehouseUuid(param)) {
    const res = await query(`SELECT * FROM ic_warehouses WHERE id = $1 LIMIT 1`, [param]);
    return res.rows[0] ? mapICWarehouseRow(res.rows[0]) : null;
  }

  const slug = param.toLowerCase();
  const res = await query(`SELECT * FROM ic_warehouses`);
  const matches = res.rows
    .map(row => mapICWarehouseRow(row))
    .filter(w => warehouseShortSlug(w.id) === slug);

  if (matches.length !== 1) return null;
  return matches[0];
}
