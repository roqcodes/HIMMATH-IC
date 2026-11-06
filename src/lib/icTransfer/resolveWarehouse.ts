import { query } from '@/lib/db';
import { mapICWarehouseRow } from '@/lib/icTransferMappers';
import type { ICWarehouse } from '@/types';
import {
  isFullWarehouseUuid,
  isWarehouseRouteShortSlug,
  WAREHOUSE_ROUTE_SLUG_SQL,
} from '@/lib/icTransfer/warehouseSlug';

export async function fetchWarehouseByRouteParam(param: string): Promise<ICWarehouse | null> {
  if (!param) return null;

  if (isFullWarehouseUuid(param)) {
    const res = await query(`SELECT * FROM ic_warehouses WHERE id = $1 LIMIT 1`, [param]);
    return res.rows[0] ? mapICWarehouseRow(res.rows[0]) : null;
  }

  const slug = param.toLowerCase();
  if (!isWarehouseRouteShortSlug(slug)) return null;

  const res = await query(
    `SELECT * FROM ic_warehouses
     WHERE ${WAREHOUSE_ROUTE_SLUG_SQL} = $1
     LIMIT 2`,
    [slug],
  );

  if (res.rows.length !== 1) return null;
  return mapICWarehouseRow(res.rows[0]);
}
