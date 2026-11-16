'use server';

import { query } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getSessionUser } from '@/lib/auth';
import {
  groupCustomerAedDealsByWarehouse,
  mapCustomerAedDealRow,
  type CustomerAedDealsByWarehouse,
} from '@/lib/partyPayment/customerAedDeals';

const DEAL_LIMIT = 150;

export async function listCustomerAedDealsAction(params: {
  counterpartyId: string;
  warehouseId?: string | null;
}): Promise<CustomerAedDealsByWarehouse[]> {
  const counterpartyId = String(params.counterpartyId || '').trim();
  if (!counterpartyId) return [];

  try {
    const user = await getSessionUser();
    if (!user || user.role === 'customer') return [];

    const warehouseFilter = params.warehouseId?.trim() || null;

    const purchaseRes = await query(
      `SELECT p.id::text AS id, 'purchase'::text AS deal_kind,
              p.warehouse_id::text AS warehouse_id, w.name AS warehouse_name,
              p.created_at, p.metal_payment_method, p.aed_total, p.split_aed_paid,
              p.aed_agent_id::text AS aed_agent_id, aa.name AS aed_agent_name,
              p.manager_id::text AS manager_id, p.metal_weight_g
       FROM ic_purchases p
       INNER JOIN ic_warehouses w ON w.id = p.warehouse_id
       LEFT JOIN ic_aed_agents aa ON aa.id = p.aed_agent_id
       WHERE p.counterparty_id = $1::uuid
         AND p.warehouse_id IS NOT NULL
         AND p.settlement_mode = 'metal'
         AND COALESCE(p.metal_payment_method, 'CASH') IN ('AED', 'SPLIT')
         AND ($2::uuid IS NULL OR p.warehouse_id = $2::uuid)
       ORDER BY p.created_at DESC
       LIMIT $3`,
      [counterpartyId, warehouseFilter, DEAL_LIMIT],
    );

    const saleRes = await query(
      `SELECT s.id::text AS id, 'sale'::text AS deal_kind,
              s.warehouse_id::text AS warehouse_id, w.name AS warehouse_name,
              s.created_at, s.metal_payment_method, s.aed_amount AS aed_total, s.split_aed_paid,
              s.aed_agent_id::text AS aed_agent_id, aa.name AS aed_agent_name,
              s.manager_id::text AS manager_id, s.metal_weight_g
       FROM ic_sales s
       INNER JOIN ic_warehouses w ON w.id = s.warehouse_id
       LEFT JOIN ic_aed_agents aa ON aa.id = s.aed_agent_id
       WHERE s.counterparty_id = $1::uuid
         AND s.warehouse_id IS NOT NULL
         AND s.settlement_mode = 'metal'
         AND COALESCE(s.metal_payment_method, 'CASH') IN ('AED', 'SPLIT')
         AND s.order_status NOT IN ('cancelled', 'admin_rejected')
         AND ($2::uuid IS NULL OR s.warehouse_id = $2::uuid)
       ORDER BY s.created_at DESC
       LIMIT $3`,
      [counterpartyId, warehouseFilter, DEAL_LIMIT],
    );

    type DealRow = Parameters<typeof mapCustomerAedDealRow>[0];
    const lines = [...purchaseRes.rows, ...saleRes.rows]
      .map(row => mapCustomerAedDealRow(row as DealRow))
      .filter((line): line is NonNullable<ReturnType<typeof mapCustomerAedDealRow>> => line != null);

    return groupCustomerAedDealsByWarehouse(lines);
  } catch (err) {
    logger.error({ err, params }, 'listCustomerAedDealsAction');
    return [];
  }
}
