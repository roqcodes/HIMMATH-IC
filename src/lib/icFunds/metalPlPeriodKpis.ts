import 'server-only';

import { query } from '@/lib/db';
import { isHqIcFundsBranchId } from '@/lib/icFunds/hqBranch';
import { resolveBranchTimeZone } from '@/lib/businessTime';
import { isMetalAedPayment } from '@/lib/domain/books';
import { allocateMetalLotCostAed, allocateMetalLotCostInr } from '@/lib/icTransfer/metalLotCost';
import { computeMetalLotProfit } from '@/lib/icTransfer/metalInventory';
import { sqlExcludeVoidIcSales } from '@/lib/icFunds/icTransferReportFilters';
import { netMetalInr } from '@/lib/icTransfer/labTest';
import type { MetalPlPeriodKpis } from '@/lib/icFunds/plReportTypes';

type MetalLotRow = {
  inrTotal: number;
  aedTotal: number;
  metalWeightG: number;
  paymentMethod: string | null;
  labTotalInr: number;
};

/** Period metal P&L roll-ups for the Profit & loss tab (INR economics). */
export async function queryMetalPlPeriodKpis(opts: {
  branchId: string;
  startDate?: string | null;
  endDate?: string | null;
  warehouseId?: string | null;
  branchTimeZone?: string | null;
}): Promise<MetalPlPeriodKpis> {
  const { branchId, startDate, endDate, warehouseId, branchTimeZone } = opts;
  const isHqLedger = isHqIcFundsBranchId(branchId);
  const params: unknown[] = [];
  let idx = 1;
  const tz = resolveBranchTimeZone(branchTimeZone);
  const saleCalendarDate = `(COALESCE(s.status_updated_at, s.created_at) AT TIME ZONE '${tz}')::date`;

  const branchFilter = isHqLedger ? '' : `AND (w.branch_id = $${idx++} OR w.branch_id IS NULL)`;
  if (!isHqLedger) params.push(branchId);

  let periodSql = '';
  if (startDate) {
    periodSql += ` AND ${saleCalendarDate} >= $${idx++}::date`;
    params.push(startDate);
  }
  if (endDate) {
    periodSql += ` AND ${saleCalendarDate} <= $${idx++}::date`;
    params.push(endDate);
  }
  let whSql = '';
  if (warehouseId?.trim()) {
    whSql = ` AND s.warehouse_id = $${idx++}::uuid`;
    params.push(warehouseId.trim());
  }

  const salesRes = await query(
    `SELECT
       s.id,
       s.metal_weight_g,
       s.inr_total,
       s.lab_total_inr,
       s.aed_amount,
       s.service_charge,
       s.metal_purchase_id,
       s.metal_payment_method,
       COALESCE(s.status_updated_at, s.created_at) AS sale_at
     FROM ic_sales s
     JOIN ic_warehouses w ON w.id = s.warehouse_id
     WHERE s.settlement_mode = 'metal'
       AND COALESCE(s.order_status, 'completed') NOT IN (
         'branch_rejected', 'admin_rejected', 'wh_rejected', 'da_rejected',
         'cancelled', 'cancellation_pending'
       )
       ${sqlExcludeVoidIcSales('s')}
       ${branchFilter}
       ${periodSql}
       ${whSql}
     ORDER BY sale_at ASC`,
    params,
  );

  const lotIds = [
    ...new Set(
      salesRes.rows
        .map(r => (r.metal_purchase_id ? String(r.metal_purchase_id) : ''))
        .filter(Boolean),
    ),
  ];

  const lotById = new Map<string, MetalLotRow>();
  if (lotIds.length > 0) {
    const lotsRes = await query(
      `SELECT id, inr_total, aed_total, metal_weight_g, metal_payment_method, lab_total_inr
       FROM ic_purchases
       WHERE id = ANY($1::uuid[])`,
      [lotIds],
    );
    for (const row of lotsRes.rows) {
      lotById.set(String(row.id), {
        inrTotal: Number(row.inr_total) || 0,
        aedTotal: Number(row.aed_total) || 0,
        metalWeightG: Number(row.metal_weight_g) || 0,
        paymentMethod: row.metal_payment_method ? String(row.metal_payment_method) : null,
        labTotalInr: Number(row.lab_total_inr) || 0,
      });
    }
  }

  let metalSoldG = 0;
  let metalSaleInr = 0;
  let metalCogsInr = 0;
  let metalProfitInr = 0;

  for (const row of salesRes.rows) {
    const saleG = Number(row.metal_weight_g) || 0;
    const saleInr = netMetalInr(Number(row.inr_total) || 0, Number(row.lab_total_inr) || 0);
    const saleAed = (Number(row.aed_amount) || 0) + (Number(row.service_charge) || 0);
    const lotId = row.metal_purchase_id ? String(row.metal_purchase_id) : null;
    const lot = lotId ? lotById.get(lotId) : undefined;
    const paymentMethod = isMetalAedPayment(row.metal_payment_method) ? 'AED' : 'CASH';

    const pl = computeMetalLotProfit({
      paymentMethod,
      purchasePaymentMethod: lot?.paymentMethod ?? undefined,
      weightG: saleG,
      purchaseInr: lot
        ? allocateMetalLotCostInr(
            { inrTotal: lot.inrTotal, metalWeightG: lot.metalWeightG, labTotalInr: lot.labTotalInr },
            saleG,
          )
        : 0,
      purchaseAed: lot
        ? allocateMetalLotCostAed({ aedTotal: lot.aedTotal, metalWeightG: lot.metalWeightG }, saleG)
        : 0,
      saleInr,
      saleAed,
    });

    metalSoldG += saleG;
    metalSaleInr += pl.saleInr;
    metalCogsInr += pl.purchaseInr;
    metalProfitInr += pl.profitInr;
  }

  return {
    metalSoldG: Number(metalSoldG.toFixed(4)),
    metalSaleInr: Number(metalSaleInr.toFixed(2)),
    metalCogsInr: Number(metalCogsInr.toFixed(2)),
    metalProfitInr: Number(metalProfitInr.toFixed(2)),
  };
}
