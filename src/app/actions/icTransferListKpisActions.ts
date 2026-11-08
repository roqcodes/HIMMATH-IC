'use server';

import { query } from '@/lib/db';
import { INR_PER_UNIT } from '@/lib/domain/books';

export type IcTransferListKpis = {
  icPurchaseInr: number;
  icSaleInr: number;
  metalWeightPurchasedG: number;
  metalWeightSoldG: number;
};

/** Aggregated KPIs for IC Transfer lists — no full-table client hydration. */
export async function fetchIcTransferListKpisAction(
  branchId?: string | null,
  startDate?: string | null,
  endDate?: string | null,
): Promise<IcTransferListKpis> {
  const branchFilter = branchId
    ? `AND (w.branch_id = $3 OR w.branch_id IS NULL)`
    : '';
  const params: unknown[] = [startDate || '1970-01-01', endDate || '2099-12-31'];
  if (branchId) params.push(branchId);

  const purchaseRes = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN p.settlement_mode = 'cash' THEN p.units ELSE 0 END), 0) AS ic_units,
       COALESCE(SUM(CASE WHEN p.settlement_mode = 'metal' THEN p.metal_weight_g ELSE 0 END), 0) AS metal_g
     FROM ic_purchases p
     LEFT JOIN ic_warehouses w ON w.id = p.warehouse_id
     WHERE p.created_at >= $1::date AND p.created_at < ($2::date + interval '1 day')
     ${branchFilter}`,
    params,
  );

  const saleRes = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN s.settlement_mode = 'cash' AND s.order_status = 'completed' THEN s.units ELSE 0 END), 0) AS ic_units,
       COALESCE(SUM(CASE WHEN s.settlement_mode = 'metal' AND s.order_status = 'completed' THEN s.metal_weight_g ELSE 0 END), 0) AS metal_g
     FROM ic_sales s
     LEFT JOIN ic_warehouses w ON w.id = s.warehouse_id
     WHERE s.created_at >= $1::date AND s.created_at < ($2::date + interval '1 day')
     ${branchFilter}`,
    params,
  );

  const pu = purchaseRes.rows[0] || {};
  const sa = saleRes.rows[0] || {};
  return {
    icPurchaseInr: Number(pu.ic_units || 0) * INR_PER_UNIT,
    icSaleInr: Number(sa.ic_units || 0) * INR_PER_UNIT,
    metalWeightPurchasedG: Number(pu.metal_g || 0),
    metalWeightSoldG: Number(sa.metal_g || 0),
  };
}
