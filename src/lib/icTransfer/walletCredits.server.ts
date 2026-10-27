import 'server-only';

import type { QueryResult } from 'pg';
import { remainingForeignOwed, resolveSaleForeignPaymentStatus, roundFxCalc } from '@/lib/icTransfer/saleFxProfit';
import { buildFifoWalletPaymentAllocations, roundWalletForeign, roundWalletRate } from '@/lib/icTransfer/icWallet';
import { OPEN_CUSTOMER_SALES_SQL } from '@/lib/icTransfer/walletQueries';

type DbClient = {
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
};

function mapOpenSale(row: Record<string, unknown>) {
  const convertedAmount = Number(row.converted_amount) || 0;
  const foreignCollected = Number(row.foreign_collected) || 0;
  return {
    saleId: String(row.id),
    units: Number(row.units) || 0,
    unitRate: Number(row.unit_rate) || 0,
    aedAmount: Number(row.aed_amount) || 0,
    convertedAmount,
    conversionRate: Number(row.conversion_rate),
    foreignRemaining: remainingForeignOwed(convertedAmount, foreignCollected),
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : undefined,
  };
}

/**
 * Attach unapplied wallet credit (overpay) to later open sales, FIFO.
 * Credits stay on the agent until a sale exists to apply them against.
 */
export async function applyUnappliedWalletCredits(
  client: DbClient,
  opts: { customerId: string; collectionAccountId?: string },
): Promise<void> {
  const filters = ['wsa.customer_id = $1', 'wsa.sale_id IS NULL', 'wsa.allocated_foreign - wsa.settled_foreign > 1e-12'];
  const params: unknown[] = [opts.customerId];
  if (opts.collectionAccountId) {
    params.push(opts.collectionAccountId);
    filters.push(`wsa.collection_account_id = $${params.length}`);
  }

  const unappliedRes = await client.query(
    `SELECT wsa.id, wsa.wallet_transaction_id, wsa.customer_id, wsa.collection_account_id,
            wsa.allocated_foreign, wsa.settled_foreign
     FROM ic_wallet_sale_allocations wsa
     JOIN ic_wallet_transactions wt ON wt.id = wsa.wallet_transaction_id AND wt.status = 'approved'
     WHERE ${filters.join(' AND ')}
     ORDER BY wsa.id
     FOR UPDATE`,
    params,
  );
  if (unappliedRes.rows.length === 0) return;

  const salesRes = await client.query(`${OPEN_CUSTOMER_SALES_SQL} ORDER BY s.created_at ASC, s.id ASC`, [
    opts.customerId,
  ]);
  const openSales = salesRes.rows.map(mapOpenSale).filter(s => s.foreignRemaining > 1e-10);
  if (openSales.length === 0) return;

  for (const row of unappliedRes.rows) {
    const credit = roundFxCalc(Number(row.allocated_foreign) - Number(row.settled_foreign));
    if (credit <= 1e-10) continue;
    const fifo = buildFifoWalletPaymentAllocations(openSales, credit);
    const saleAllocs = fifo.filter(a => a.saleId);
    const leftover = fifo.find(a => !a.saleId);

    for (const alloc of saleAllocs) {
      await client.query(
        `INSERT INTO ic_wallet_sale_allocations (
           wallet_transaction_id, sale_id, customer_id, collection_account_id,
           allocated_foreign, sale_conversion_rate
         ) VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          row.wallet_transaction_id,
          alloc.saleId,
          row.customer_id,
          row.collection_account_id,
          roundWalletForeign(alloc.allocatedForeign),
          roundWalletRate(Number(alloc.saleConversionRate)),
        ],
      );
      const sale = openSales.find(s => s.saleId === alloc.saleId);
      if (sale) {
        sale.foreignRemaining = roundFxCalc(sale.foreignRemaining - alloc.allocatedForeign);
      }
    }

    const remain = leftover?.allocatedForeign ?? 0;
    if (remain <= 1e-10) {
      await client.query(`DELETE FROM ic_wallet_sale_allocations WHERE id = $1`, [row.id]);
    } else if (remain < credit - 1e-10) {
      await client.query(
        `UPDATE ic_wallet_sale_allocations
         SET allocated_foreign = $1
         WHERE id = $2`,
        [roundWalletForeign(remain), row.id],
      );
    }
  }

  const statusRes = await client.query(OPEN_CUSTOMER_SALES_SQL, [opts.customerId]);
  for (const saleRow of statusRes.rows) {
    const convertedAmount = Number(saleRow.converted_amount) || 0;
    const foreignCollected = Number(saleRow.foreign_collected) || 0;
    await client.query(
      `UPDATE ic_sales SET payment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [resolveSaleForeignPaymentStatus(convertedAmount, foreignCollected), String(saleRow.id)],
    );
  }
}

export async function applyUnappliedCreditsForAgent(
  client: DbClient,
  collectionAccountId: string,
): Promise<void> {
  const res = await client.query(
    `SELECT DISTINCT wsa.customer_id
     FROM ic_wallet_sale_allocations wsa
     JOIN ic_wallet_transactions wt ON wt.id = wsa.wallet_transaction_id AND wt.status = 'approved'
     WHERE wsa.collection_account_id = $1
       AND wsa.sale_id IS NULL
       AND wsa.allocated_foreign - wsa.settled_foreign > 1e-12`,
    [collectionAccountId],
  );
  for (const row of res.rows) {
    await applyUnappliedWalletCredits(client, {
      customerId: String(row.customer_id),
      collectionAccountId,
    });
  }
}
