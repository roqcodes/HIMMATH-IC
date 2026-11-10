import 'server-only';

import { query } from '@/lib/db';
import { HQ_IC_FUNDS_BRANCH_ID } from '@/lib/icFunds/hqBranch';
import { logger } from '@/lib/logger';
import { syncICSaleToICFunds, syncICPurchaseToICFunds } from '@/lib/icFunds/icTransferFundSync';
import { tryAllocateCapitalFromAedVoucher, tryAllocateCapitalFromInrVoucher } from '@/lib/capital/voucherHook';
import { voidCapitalAllocationsForVoucher } from '@/lib/capital/allocation';
import { withTransaction } from '@/lib/db';

/** Repost completed cash IC sales at a warehouse when party, COGS, or profit journals are missing. */
export async function healWarehouseCashDealLedgers(warehouseId: string): Promise<void> {
  const wh = String(warehouseId || '').trim();
  if (!wh) return;

  const sales = await query<{ id: string }>(
    `SELECT s.id::text AS id
     FROM ic_sales s
     WHERE s.warehouse_id = $1::uuid
       AND COALESCE(s.settlement_mode, 'cash') <> 'metal'
       AND s.order_status = 'completed'
       AND (
         NOT EXISTS (
           SELECT 1 FROM ic_fund_vouchers v
           WHERE v.branch_id = $2
             AND v.reference_type = 'ic_sale'
             AND CAST(v.reference_id AS text) = CAST(s.id AS text)
             AND COALESCE(v.status, 'active') <> 'void'
         )
         OR NOT EXISTS (
           SELECT 1 FROM ic_fund_vouchers v
           WHERE v.branch_id = $2
             AND v.reference_type = 'ic_sale_profit'
             AND CAST(v.reference_id AS text) = CAST(s.id AS text)
             AND COALESCE(v.status, 'active') <> 'void'
         )
       )`,
    [wh, HQ_IC_FUNDS_BRANCH_ID],
  );

  for (const row of sales.rows) {
    try {
      await syncICSaleToICFunds(String(row.id));
    } catch (err) {
      logger.warn({ err, saleId: row.id, warehouseId: wh }, 'Failed to heal warehouse IC sale ledger');
    }
  }

  const purchases = await query<{ id: string }>(
    `SELECT p.id::text AS id
     FROM ic_purchases p
     WHERE p.warehouse_id = $1::uuid
       AND COALESCE(p.settlement_mode, 'cash') <> 'metal'
       AND NOT EXISTS (
         SELECT 1 FROM ic_fund_vouchers v
         WHERE v.branch_id = $2
           AND v.reference_type = 'ic_purchase'
           AND CAST(v.reference_id AS text) = CAST(p.id AS text)
           AND COALESCE(v.status, 'active') <> 'void'
       )`,
    [wh, HQ_IC_FUNDS_BRANCH_ID],
  );

  for (const row of purchases.rows) {
    try {
      await syncICPurchaseToICFunds(String(row.id));
    } catch (err) {
      logger.warn({ err, purchaseId: row.id, warehouseId: wh }, 'Failed to heal warehouse IC purchase ledger');
    }
  }
}

/** Close Metal AED clearing into Metal FX Profit when a completed AED metal sale is missing that journal. */
export async function healMissingMetalFxProfitJournals(): Promise<void> {
  const sales = await query<{ id: string }>(
    `SELECT s.id::text AS id
     FROM ic_sales s
     WHERE COALESCE(s.settlement_mode, 'cash') = 'metal'
       AND COALESCE(s.metal_payment_method, 'AED') = 'AED'
       AND s.order_status = 'completed'
       AND COALESCE(s.aed_amount, 0) > 0
       AND NOT EXISTS (
         SELECT 1 FROM ic_fund_vouchers v
         WHERE v.branch_id = $1
           AND v.reference_type = 'metal_fx_profit'
           AND CAST(v.reference_id AS text) = CAST(s.id AS text)
           AND COALESCE(v.status, 'active') <> 'void'
       )`,
    [HQ_IC_FUNDS_BRANCH_ID],
  );
  for (const row of sales.rows) {
    try {
      await syncICSaleToICFunds(String(row.id));
    } catch (err) {
      logger.warn({ err, saleId: row.id }, 'Failed to heal metal FX profit journal');
    }
  }
}

/** Metal FX stays on the AED ledger; it must not split to investors. */
async function voidMetalFxProfitAllocations(
  client: Parameters<typeof tryAllocateCapitalFromAedVoucher>[0],
): Promise<void> {
  const fx = await client.query(
    `SELECT v.id::text AS id
     FROM ic_fund_vouchers v
     WHERE v.branch_id = $1
       AND v.status = 'active'
       AND v.reference_type = 'metal_fx_profit'
       AND EXISTS (
         SELECT 1 FROM ic_capital_allocations a
         WHERE a.source_voucher_id = v.id::text
           AND a.source_book = 'AED'
           AND a.status = 'active'
           AND a.kind IN ('profit', 'expense', 'management')
       )`,
    [HQ_IC_FUNDS_BRANCH_ID],
  );
  for (const row of fx.rows) {
    await voidCapitalAllocationsForVoucher(client, String(row.id), 'AED');
  }
}

/** Allocate investor shares for profit journals that posted before the capital hook ran. */
export async function backfillHqCapitalAllocationsFromProfitVouchers(): Promise<void> {
  try {
    await withTransaction(async client => {
      await voidMetalFxProfitAllocations(client);

      const aedRes = await client.query<{ id: string }>(
        `SELECT v.id::text AS id
         FROM ic_fund_vouchers v
         WHERE v.branch_id = $1
           AND v.status = 'active'
           AND v.reference_type = 'ic_sale_profit'
           AND NOT EXISTS (
             SELECT 1 FROM ic_capital_allocations a
             WHERE a.source_voucher_id = v.id::text
               AND a.source_book = 'AED'
               AND a.status = 'active'
               AND a.kind IN ('profit', 'expense', 'management')
           )`,
        [HQ_IC_FUNDS_BRANCH_ID],
      );
      for (const row of aedRes.rows) {
        await tryAllocateCapitalFromAedVoucher(client, HQ_IC_FUNDS_BRANCH_ID, String(row.id));
      }

      const inrRes = await client.query<{ id: string }>(
        `SELECT v.id::text AS id
         FROM inr_fund_vouchers v
         WHERE v.branch_id = $1
           AND v.status = 'active'
           AND v.reference_type = 'metal_sale_profit'
           AND NOT EXISTS (
             SELECT 1 FROM ic_capital_allocations a
             WHERE a.source_voucher_id = v.id::text
               AND a.source_book = 'INR'
               AND a.status = 'active'
               AND a.kind IN ('profit', 'expense', 'management')
           )`,
        [HQ_IC_FUNDS_BRANCH_ID],
      );
      for (const row of inrRes.rows) {
        await tryAllocateCapitalFromInrVoucher(client, HQ_IC_FUNDS_BRANCH_ID, String(row.id));
      }

      await rebalanceHqOnlyProfitAllocations(client);
    });
  } catch (err) {
    logger.warn({ err }, 'Capital allocation backfill failed');
  }
}

/** Void HQ-only profit slices and re-split when investor capital lots exist now. */
async function rebalanceHqOnlyProfitAllocations(
  client: Parameters<typeof tryAllocateCapitalFromAedVoucher>[0],
): Promise<void> {
  const mis = await client.query(
    `SELECT a.source_voucher_id, a.source_book
     FROM ic_capital_allocations a
     JOIN ic_capital_investors i ON i.id = a.investor_id
     WHERE a.branch_id = $1 AND a.status = 'active' AND a.kind = 'profit'
       AND i.is_house = true AND ABS(a.allocated_amount) > 0.0001
       AND NOT EXISTS (
         SELECT 1 FROM ic_capital_allocations a2
         JOIN ic_capital_investors i2 ON i2.id = a2.investor_id
         WHERE a2.source_voucher_id = a.source_voucher_id
           AND a2.source_book = a.source_book
           AND a2.status = 'active'
           AND a2.kind = 'profit'
           AND i2.is_house = false
           AND ABS(a2.allocated_amount) > 0.0001
       )
       AND EXISTS (
         SELECT 1 FROM ic_capital_lots l
         JOIN ic_capital_investors inv ON inv.id = l.investor_id
         WHERE l.branch_id = $1 AND l.status = 'active'
           AND inv.is_house = false
           AND l.movement_type IN ('opening', 'deposit', 'withdraw')
           AND ABS(l.aed_eq) > 0.0001
       )
     GROUP BY a.source_voucher_id, a.source_book`,
    [HQ_IC_FUNDS_BRANCH_ID],
  );

  for (const row of mis.rows) {
    const book = row.source_book === 'INR' ? 'INR' : 'AED';
    const voucherId = String(row.source_voucher_id);
    if (book === 'INR') {
      await tryAllocateCapitalFromInrVoucher(client, HQ_IC_FUNDS_BRANCH_ID, voucherId, {
        useCurrentCapitalShares: true,
      });
    } else {
      await tryAllocateCapitalFromAedVoucher(client, HQ_IC_FUNDS_BRANCH_ID, voucherId, {
        useCurrentCapitalShares: true,
      });
    }
  }
}
