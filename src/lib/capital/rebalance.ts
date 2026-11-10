import 'server-only';

import { withTransaction } from '@/lib/db';
import { HQ_IC_FUNDS_BRANCH_ID } from '@/lib/icFunds/hqBranch';
import { logger } from '@/lib/logger';
import { tryAllocateCapitalFromAedVoucher, tryAllocateCapitalFromInrVoucher } from '@/lib/capital/voucherHook';

type DbClient = Parameters<typeof tryAllocateCapitalFromAedVoucher>[0];

/** Re-split profit vouchers that still sit 100% on house after non-house investors received capital. */
async function rebalanceHqOnlyProfitAllocations(client: DbClient): Promise<void> {
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

export async function rebalanceHqCapitalProfitSplits(): Promise<void> {
  try {
    await withTransaction(async client => {
      await rebalanceHqOnlyProfitAllocations(client);
    });
  } catch (err) {
    logger.warn({ err }, 'Capital profit rebalance failed');
  }
}
