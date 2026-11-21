import type { PoolClient, QueryResult } from 'pg';
import { remainingIcStockWac } from '@/lib/icTransfer/dealProfit';
import { mapICPurchaseRow, mapICSaleRow } from '@/lib/icTransferMappers';
import type { ICPurchase, ICSale } from '@/types';

/** On-hand IC units: opening + cash IC purchases + metal INR sales − cash IC sales. */
/** Sheet RATE (~36.5) implied by WAC on remaining stock (legacy pools may be 100× smaller internally). */
export function computeWarehouseIcStockWac(
  purchases: ICPurchase[],
  sales: ICSale[],
  warehouseId: string,
  openingStock = 0,
  openingAed = 0,
): number {
  return remainingIcStockWac(purchases, sales, warehouseId, openingStock, openingAed).rate;
}

/** Reconcile physical metal grams from warehouse deals. INR units are synced from the INR ledger. */
type StockClient = PoolClient | { query: (text: string, params?: unknown[]) => Promise<QueryResult> };

export async function syncWarehouseIcStockColumn(
  client: StockClient,
  warehouseId: string,
): Promise<void> {
  if (!warehouseId?.trim()) return;

  const [whRes, pRes, sRes] = await Promise.all([
    client.query(`SELECT opening_stock, opening_metal_g FROM ic_warehouses WHERE id = $1 LIMIT 1`, [
      warehouseId,
    ]),
    client.query(`SELECT * FROM ic_purchases WHERE warehouse_id = $1`, [warehouseId]),
    client.query(`SELECT * FROM ic_sales WHERE warehouse_id = $1`, [warehouseId]),
  ]);
  if (whRes.rows.length === 0) return;

  const purchases = pRes.rows.map(mapICPurchaseRow);
  const sales = sRes.rows.map(mapICSaleRow);
  const openingMetalG = Number(whRes.rows[0].opening_metal_g) || 0;
  const metalG = computeWarehouseMetalGramsFromDeals(purchases, sales, warehouseId, openingMetalG);

  await client.query(
    `UPDATE ic_warehouses SET current_metal_g = $2 WHERE id = $1`,
    [warehouseId, metalG],
  );
}

function computeWarehouseMetalGramsFromDeals(
  purchases: ICPurchase[],
  sales: ICSale[],
  warehouseId: string,
  openingMetalG: number,
): number {
  let grams = Number(openingMetalG) || 0;
  for (const p of purchases) {
    if (p.warehouseId !== warehouseId || p.settlementMode !== 'metal') continue;
    grams += Number(p.metalWeightG) || 0;
  }
  for (const s of sales) {
    if (s.warehouseId !== warehouseId || s.settlementMode !== 'metal') continue;
    if (String(s.orderStatus || '') !== 'completed') continue;
    grams -= Number(s.metalWeightG) || 0;
  }
  return Number(grams.toFixed(4));
}
