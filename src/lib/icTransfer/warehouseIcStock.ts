import type { PoolClient } from 'pg';
import { remainingIcStockWac } from '@/lib/icTransfer/dealProfit';
import { mapICPurchaseRow, mapICSaleRow } from '@/lib/icTransferMappers';
import type { ICPurchase, ICSale } from '@/types';

/** On-hand IC units: cash IC purchases + metal INR sales − cash IC sales. */
export function computeWarehouseIcUnitsOnHand(
  purchases: ICPurchase[],
  sales: ICSale[],
  warehouseId: string,
): number {
  return remainingIcStockWac(purchases, sales, warehouseId).units;
}

/** Weighted average **AED rate per IC unit** on remaining stock (cash IC + metal INR inflows). */
export function computeWarehouseIcStockWac(
  purchases: ICPurchase[],
  sales: ICSale[],
  warehouseId: string,
): number {
  return remainingIcStockWac(purchases, sales, warehouseId).rate;
}

/** Reconcile `ic_warehouses.current_stock` from purchase/sale rows (fixes legacy double-counts). */
export async function syncWarehouseIcStockColumn(
  client: PoolClient,
  warehouseId: string,
): Promise<void> {
  if (!warehouseId?.trim()) return;

  const [pRes, sRes] = await Promise.all([
    client.query(`SELECT * FROM ic_purchases WHERE warehouse_id = $1`, [warehouseId]),
    client.query(`SELECT * FROM ic_sales WHERE warehouse_id = $1`, [warehouseId]),
  ]);

  const purchases = pRes.rows.map(mapICPurchaseRow);
  const sales = sRes.rows.map(mapICSaleRow);
  const units = computeWarehouseIcUnitsOnHand(purchases, sales, warehouseId);

  await client.query(`UPDATE ic_warehouses SET current_stock = $2 WHERE id = $1`, [
    warehouseId,
    units,
  ]);
}
