'use server';

import { z } from 'zod';
import { randomUUID } from 'crypto';
import { query, runQueryBatch, withTransaction, sortedIds } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { assertStaffWriteAccess } from '@/app/actions/permissionActions';
import { logger } from '@/lib/logger';
import { HQ_IC_FUNDS_BRANCH_ID } from '@/lib/icFunds/hqBranch';
import {
  buildFifoAllocations,
  computeAgentGroupClosingSummary,
  computeSaleFxSettlementAmounts,
  formatFxAmount,
  isForeignCurrencySale,
  remainingForeignOwed,
  roundFxCalc,
  sortSalesFifo,
  validateBatchFxAllocations,
  type FxBatchAllocation,
  type FxOpenSaleLine,
} from '@/lib/icTransfer/saleFxProfit';
import { syncSaleFxSettlementLedgerInTx, postFxSettlementBatchPaymentInTx } from '@/lib/icFunds/icTransferFundSync';
import { ensureHqIcFundsBranch } from '@/lib/icFunds/ensureHqBranch';
import { FX_REMITTANCE_RECEIVE_TYPES } from '@/lib/icFunds/voucherRules';
import { accountBalanceSql, accountMovementJoinSql } from '@/lib/icFunds/accountBalance';
import { aggregateByCurrency, roundLedgerAmount } from '@/lib/icFunds/currencyPolicy';
import type { ICFundAccountType } from '@/lib/icFunds/constants';
import { applyUnappliedCreditsForAgent } from '@/lib/icTransfer/walletCredits.server';
import { positiveFormAmountSchema } from '@/lib/parseFormAmount';
import { FX_SETTLEMENT_LIST_PAGE_SIZE } from '@/lib/icTransfer/saleFxSettlementQueries';

const customerFxSettlementSchema = z.object({
  collectionAccountId: z.string().trim().min(1),
  customerKey: z.string().trim().min(1),
  toAccountId: z.string().trim().min(1),
  paidForeign: positiveFormAmountSchema,
  settlementRate: positiveFormAmountSchema,
  settledAt: z.string().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

const agentFxSettlementSchema = z.object({
  collectionAccountId: z.string().trim().min(1),
  toAccountId: z.string().trim().min(1),
  paidForeign: positiveFormAmountSchema,
  settlementRate: positiveFormAmountSchema,
  settledAt: z.string().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

const batchSettlementSchema = z.object({
  collectionAccountId: z.string().trim().min(1),
  toAccountId: z.string().trim().min(1),
  allocations: z
    .array(
      z.object({
        saleId: z.string().uuid(),
        paidForeign: positiveFormAmountSchema,
        settlementRate: positiveFormAmountSchema,
      }),
    )
    .min(1),
  settledAt: z.string().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

const WALLET_PAID_LATERAL = `
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(wsa.allocated_foreign), 0) AS total_paid
    FROM ic_wallet_sale_allocations wsa
    JOIN ic_wallet_transactions wt ON wt.id = wsa.wallet_transaction_id
    WHERE wsa.sale_id = s.id AND wt.status = 'approved'
  ) wallet_paid ON TRUE
`;

/** Customer sales with foreign still owed (not yet paid to any agent). */
const OPEN_CUSTOMER_SALES_SQL = `
  SELECT s.*,
         COALESCE(wallet_paid.total_paid, 0) AS foreign_collected
  FROM ic_sales s
  ${WALLET_PAID_LATERAL}
  WHERE s.order_status = 'completed'
    AND UPPER(COALESCE(s.currency, 'AED')) NOT IN ('AED', 'CURRENCY')
    AND COALESCE(s.conversion_rate, 0) > 0
    AND COALESCE(s.converted_amount, 0) > 0
    AND COALESCE(wallet_paid.total_paid, 0) < COALESCE(s.converted_amount, 0) - 0.0001
`;

const AGENT_UNSETTLED_ROWS_SQL = `
  SELECT wsa.id AS wallet_allocation_id,
         wsa.sale_id,
         wsa.customer_id,
         wsa.collection_account_id,
         a.name AS collection_account_name,
         a.currency AS agent_currency,
         wsa.allocated_foreign,
         wsa.settled_foreign,
         (wsa.allocated_foreign - wsa.settled_foreign) AS unsettled_foreign,
         wsa.sale_conversion_rate,
         s.customer_name,
         s.order_customer_name,
         s.order_customer_id,
         s.currency,
         s.units,
         s.unit_rate,
         s.aed_amount,
         s.converted_amount,
         s.conversion_rate,
         s.created_at,
         c.name AS linked_customer_name,
         cb.slug AS customer_branch_slug
  FROM ic_wallet_sale_allocations wsa
  JOIN ic_wallet_transactions wt ON wt.id = wsa.wallet_transaction_id AND wt.status = 'approved'
  JOIN ic_sales s ON s.id = wsa.sale_id
  JOIN ic_fund_accounts a ON a.id = wsa.collection_account_id
  LEFT JOIN customers c ON c.id = wsa.customer_id
  LEFT JOIN branches cb ON cb.id = c.branch_id
  WHERE ($1::text IS NULL OR wsa.collection_account_id = $1)
    AND wsa.allocated_foreign - wsa.settled_foreign > 0.0001
  ORDER BY LOWER(a.name), s.created_at ASC, wsa.created_at ASC
`;

async function assertFxSettlementWriteAccess(branchSlug?: string) {
  const user = await getSessionUser(branchSlug);
  if (!user) return { error: 'You must be signed in.' as const, user: null };
  if (user.role === 'customer') {
    return { error: 'Customers cannot record FX settlements.' as const, user: null };
  }
  if (!branchSlug || branchSlug === 'superadmin') {
    if (user.role !== 'admin' && user.role !== 'branch_manager' && user.role !== 'staff') {
      return { error: 'Unauthorized' as const, user: null };
    }
    return { error: null, user };
  }
  const branchRes = await query(`SELECT id FROM branches WHERE slug = $1 LIMIT 1`, [branchSlug]);
  if (branchRes.rows.length === 0) {
    return { error: 'Branch not found' as const, user: null };
  }
  const branchId = String(branchRes.rows[0].id);
  if (user.branchId && user.branchId !== branchId) {
    return { error: 'You are not authorized for this branch.' as const, user: null };
  }
  const denied = await assertStaffWriteAccess(user, 'ic-funds', branchId);
  if (denied) return { error: denied, user: null };
  return { error: null, user };
}

async function assertCollectionAgentAccount(client: { query: typeof query }, accountId: string) {
  const accountRes = await client.query(
    `SELECT id, status FROM ic_fund_accounts
     WHERE id = $1 AND account_type = 'collection_agent'
     LIMIT 1`,
    [accountId],
  );
  if (accountRes.rows.length === 0) {
    throw new Error('Collection agent account not found');
  }
  if (String(accountRes.rows[0].status) !== 'active') {
    throw new Error('Collection agent account is inactive');
  }
}

async function assertFxSettlementPayToAccount(
  client: { query: typeof query },
  toAccountId: string,
  collectionAccountId: string,
) {
  if (toAccountId === collectionAccountId) {
    throw new Error('Paid-to account must differ from the collection agent');
  }
  const res = await client.query(
    `SELECT id, account_type, status, name, UPPER(COALESCE(currency, 'AED')) AS currency
     FROM ic_fund_accounts
     WHERE id = $1 AND branch_id = $2
     LIMIT 1`,
    [toAccountId, HQ_IC_FUNDS_BRANCH_ID],
  );
  if (res.rows.length === 0) {
    throw new Error('Paid-to account not found');
  }
  const row = res.rows[0];
  if (String(row.status) !== 'active') {
    throw new Error('Receive-into account is inactive');
  }
  const accountType = String(row.account_type) as ICFundAccountType;
  if (!FX_REMITTANCE_RECEIVE_TYPES.has(accountType)) {
    throw new Error('Remittance must be received into a cash/bank till or AED personal account');
  }
  if (accountType === 'personal' && String(row.currency) !== 'AED') {
    throw new Error('Only AED personal accounts can receive remittance');
  }
  return String(row.name);
}

function mapSettlementRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    saleId: String(row.sale_id),
    collectionAccountId: row.collection_account_id ? String(row.collection_account_id) : undefined,
    currency: String(row.currency),
    paidForeign: Number(row.paid_foreign),
    settlementRate: Number(row.settlement_rate),
    saleConversionRate: Number(row.sale_conversion_rate),
    settledAed: Number(row.settled_aed),
    bookedAed: Number(row.booked_aed),
    type2ProfitAed: Number(row.type2_profit_aed),
    batchId: row.batch_id ? String(row.batch_id) : undefined,
    settledAt: row.settled_at ? new Date(String(row.settled_at)).toISOString() : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    enteredBy: row.entered_by ? String(row.entered_by) : undefined,
    enteredByName: row.entered_by_name ? String(row.entered_by_name) : undefined,
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : undefined,
  };
}

function customerKeyFromRow(row: Record<string, unknown>): string {
  const id = row.order_customer_id ? String(row.order_customer_id).trim() : '';
  if (id) return `id:${id}`;
  const name = String(row.order_customer_name || row.customer_name || '')
    .trim()
    .toLowerCase();
  return `name:${name}`;
}

function customerKeyFromSale(sale: ReturnType<typeof mapOpenSaleRow>): string {
  if (sale.orderCustomerId) return `id:${sale.orderCustomerId}`;
  return `name:${sale.customerName.trim().toLowerCase()}`;
}

function mapOpenSaleRow(row: Record<string, unknown>) {
  const foreignCollected = Number(row.foreign_collected) || 0;
  const convertedAmount = Number(row.converted_amount) || 0;
  const units = Number(row.units) || 0;
  const unitRate = Number(row.unit_rate) || 0;
  return {
    id: String(row.id),
    customerName: String(row.order_customer_name || row.customer_name || ''),
    orderCustomerId: row.order_customer_id ? String(row.order_customer_id) : undefined,
    customerKey: customerKeyFromRow(row),
    currency: String(row.currency),
    units,
    unitRate,
    aedAmount: Number(row.aed_amount) || units * unitRate,
    convertedAmount,
    conversionRate: Number(row.conversion_rate),
    foreignCollected,
    foreignRemaining: remainingForeignOwed(convertedAmount, foreignCollected),
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : undefined,
  };
}

function mapAgentUnsettledSaleRow(row: Record<string, unknown>) {
  const unsettled = Number(row.unsettled_foreign) || 0;
  const units = Number(row.units) || 0;
  const unitRate = Number(row.unit_rate) || 0;
  const convertedAmount = Number(row.converted_amount) || 0;
  return {
    id: String(row.sale_id),
    customerName: String(row.order_customer_name || row.customer_name || row.linked_customer_name || ''),
    orderCustomerId: row.order_customer_id ? String(row.order_customer_id) : row.customer_id ? String(row.customer_id) : undefined,
    customerKey: row.customer_id
      ? `id:${String(row.customer_id)}`
      : customerKeyFromRow(row),
    currency: String(row.currency),
    units,
    unitRate,
    aedAmount: Number(row.aed_amount) || units * unitRate,
    convertedAmount,
    conversionRate: Number(row.sale_conversion_rate) || Number(row.conversion_rate),
    foreignCollected: 0,
    foreignRemaining: unsettled,
    customerBranchSlug: row.customer_branch_slug ? String(row.customer_branch_slug) : undefined,
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : undefined,
  };
}

function aggregateAgentSalesBySaleId(
  rows: ReturnType<typeof mapAgentUnsettledSaleRow>[],
): ReturnType<typeof mapAgentUnsettledSaleRow>[] {
  const bySale = new Map<string, ReturnType<typeof mapAgentUnsettledSaleRow>>();
  for (const row of rows) {
    const existing = bySale.get(row.id);
    if (!existing) {
      bySale.set(row.id, { ...row });
      continue;
    }
    existing.foreignRemaining = roundFxCalc(existing.foreignRemaining + row.foreignRemaining);
  }
  return [...bySale.values()];
}

function toFxOpenSaleLine(sale: ReturnType<typeof mapOpenSaleRow>): FxOpenSaleLine {
  return {
    saleId: sale.id,
    units: sale.units,
    unitRate: sale.unitRate,
    aedAmount: sale.aedAmount,
    convertedAmount: sale.convertedAmount,
    conversionRate: sale.conversionRate,
    foreignRemaining: sale.foreignRemaining,
    createdAt: sale.createdAt,
  };
}

export async function listCollectionAgentAccountsAction(branchSlug?: string) {
  try {
    const user = await getSessionUser(branchSlug);
    if (!user || user.role === 'customer') {
      return { success: false as const, error: 'Unauthorized' };
    }

    let branchId = HQ_IC_FUNDS_BRANCH_ID;
    if (branchSlug && branchSlug !== 'superadmin') {
      const branchRes = await query(`SELECT id FROM branches WHERE slug = $1 LIMIT 1`, [branchSlug]);
      if (branchRes.rows.length === 0) return { success: false as const, error: 'Branch not found' };
      branchId = String(branchRes.rows[0].id);
    }

    const res = await query(
      `SELECT id, name, phone, currency
       FROM ic_fund_accounts
       WHERE account_type = 'collection_agent'
         AND status = 'active'
         AND (branch_id = $1 OR branch_id = $2)
       ORDER BY LOWER(name)`,
      [branchId, HQ_IC_FUNDS_BRANCH_ID],
    );

    return {
      success: true as const,
      accounts: res.rows.map(row => ({
        id: String(row.id),
        name: String(row.name),
        phone: row.phone ? String(row.phone) : undefined,
        currency: row.currency ? String(row.currency).toUpperCase() : 'AED',
      })),
    };
  } catch (err) {
    logger.error({ err }, 'listCollectionAgentAccountsAction failed');
    return { success: false as const, error: 'Failed to load collection agent accounts' };
  }
}

export async function listFxSettlementPayToAccountsAction(branchSlug?: string) {
  try {
    const access = await assertFxSettlementWriteAccess(branchSlug);
    if (access.error) return { success: false as const, error: access.error };

    await ensureHqIcFundsBranch();

    const res = await query(
      `SELECT a.id, a.name, a.account_type, a.currency, a.status,
              ${accountBalanceSql()} AS balance
       FROM ic_fund_accounts a
       ${accountMovementJoinSql({ branchParam: '$1' })}
       WHERE a.branch_id = $1
         AND a.status = 'active'
         AND (
           a.account_type = 'bank'
           OR (a.account_type = 'personal' AND UPPER(COALESCE(a.currency, 'AED')) = 'AED')
         )
       ORDER BY LOWER(a.name)`,
      [HQ_IC_FUNDS_BRANCH_ID],
    );

    return {
      success: true as const,
      accounts: res.rows.map(row => ({
        id: String(row.id),
        name: String(row.name),
        accountType: String(row.account_type),
        balance: Number(row.balance) || 0,
      })),
    };
  } catch (err) {
    logger.error({ err }, 'listFxSettlementPayToAccountsAction failed');
    return { success: false as const, error: 'Failed to load pay-to accounts' };
  }
}

export async function listOpenForeignSalesAction(branchSlug?: string) {
  try {
    const user = await getSessionUser(branchSlug);
    if (!user || user.role === 'customer') {
      return { success: false as const, error: 'Unauthorized' };
    }

    const res = await query(
      `${OPEN_CUSTOMER_SALES_SQL}
       ORDER BY s.created_at DESC
       LIMIT 300`,
    );

    return {
      success: true as const,
      sales: res.rows.map(mapOpenSaleRow),
    };
  } catch (err) {
    logger.error({ err }, 'listOpenForeignSalesAction failed');
    return { success: false as const, error: 'Failed to load open foreign sales' };
  }
}

async function loadAgentUnsettledSales(
  collectionAccountId: string,
  client: { query: typeof query } = { query },
) {
  const res = await client.query(AGENT_UNSETTLED_ROWS_SQL, [collectionAccountId]);
  return aggregateAgentSalesBySaleId(res.rows.map(mapAgentUnsettledSaleRow));
}

export async function listOpenForeignSalesByAgentAction(branchSlug?: string) {
  try {
    const user = await getSessionUser(branchSlug);
    if (!user || user.role === 'customer') {
      return { success: false as const, error: 'Unauthorized' };
    }

    const rowsRes = await query(AGENT_UNSETTLED_ROWS_SQL, [null]);

    type Group = {
      collectionAccountId: string;
      collectionAccountName: string;
      currency: string;
      agentBalance: number;
      sales: ReturnType<typeof mapOpenSaleRow>[];
      closing: ReturnType<typeof computeAgentGroupClosingSummary> | null;
    };

    const grouped = new Map<string, { meta: Group; raw: ReturnType<typeof mapAgentUnsettledSaleRow>[] }>();
    for (const row of rowsRes.rows) {
      const collectionAccountId = String(row.collection_account_id);
      let entry = grouped.get(collectionAccountId);
      if (!entry) {
        entry = {
          meta: {
            collectionAccountId,
            collectionAccountName: String(row.collection_account_name || ''),
            currency: String(row.agent_currency || row.currency || '').toUpperCase(),
            agentBalance: 0,
            sales: [],
            closing: null,
          },
          raw: [],
        };
        grouped.set(collectionAccountId, entry);
      }
      entry.raw.push(mapAgentUnsettledSaleRow(row));
      entry.meta.agentBalance = roundFxCalc(
        entry.meta.agentBalance + (Number(row.unsettled_foreign) || 0),
      );
    }

    const groups: Group[] = [...grouped.values()].map(({ meta, raw }) => {
      const sales = aggregateAgentSalesBySaleId(raw);
      return {
        ...meta,
        sales,
        closing: sales.length ? computeAgentGroupClosingSummary(sales.map(toFxOpenSaleLine), []) : null,
      };
    });

    return { success: true as const, groups };
  } catch (err) {
    logger.error({ err }, 'listOpenForeignSalesByAgentAction failed');
    return { success: false as const, error: 'Failed to load grouped open sales' };
  }
}

export async function previewBatchFxSettlementAction(
  input: z.infer<typeof batchSettlementSchema>,
  branchSlug?: string,
) {
  try {
    const access = await assertFxSettlementWriteAccess(branchSlug);
    if (access.error) return { success: false as const, error: access.error };

    const parsed = batchSettlementSchema.parse(input);
    const groupSales = await loadAgentUnsettledSales(parsed.collectionAccountId);
    if (groupSales.length === 0) {
      return { success: false as const, error: 'No unsettled balance for this collection agent' };
    }

    const lines = groupSales.map(toFxOpenSaleLine);
    validateBatchFxAllocations(lines, parsed.allocations);

    const closing = computeAgentGroupClosingSummary(lines, parsed.allocations);
    const allocationDetails = parsed.allocations.map(alloc => {
      const sale = groupSales.find(s => s.id === alloc.saleId);
      if (!sale) throw new Error('Invalid allocation sale');
      const computed = computeSaleFxSettlementAmounts(
        alloc.paidForeign,
        alloc.settlementRate,
        sale.conversionRate,
      );
      return {
        ...computed,
        saleId: sale.id,
        customerName: sale.customerName,
        foreignRemainingBefore: sale.foreignRemaining,
        foreignRemainingAfter: roundFxCalc(sale.foreignRemaining - alloc.paidForeign),
      };
    });

    return { success: true as const, closing, allocationDetails };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to preview batch settlement',
    };
  }
}

function resolveCustomerOpenSales(
  sales: ReturnType<typeof mapOpenSaleRow>[],
  customerKey: string,
): FxOpenSaleLine[] {
  return sortSalesFifo(
    sales.filter(s => customerKeyFromSale(s) === customerKey).map(toFxOpenSaleLine),
  );
}

export async function recordCustomerFxSettlementAction(
  input: z.infer<typeof customerFxSettlementSchema>,
  branchSlug?: string,
) {
  try {
    const access = await assertFxSettlementWriteAccess(branchSlug);
    if (access.error) return { success: false as const, error: access.error };

    const parsed = customerFxSettlementSchema.parse(input);
    const agentSales = await loadAgentUnsettledSales(parsed.collectionAccountId);
    if (agentSales.length === 0) {
      return { success: false as const, error: 'No unsettled balance for this collection agent' };
    }

    const customerLines = resolveCustomerOpenSales(agentSales, parsed.customerKey);
    if (customerLines.length === 0) {
      return { success: false as const, error: 'No open sales for this customer under this agent' };
    }

    const allocations = buildFifoAllocations(
      customerLines,
      parsed.paidForeign,
      parsed.settlementRate,
    );

    return recordBatchFxSettlementAction(
      {
        collectionAccountId: parsed.collectionAccountId,
        toAccountId: parsed.toAccountId,
        allocations,
        settledAt: parsed.settledAt,
        notes: parsed.notes,
      },
      branchSlug,
    );
  } catch (err) {
    logger.error({ err, input }, 'recordCustomerFxSettlementAction failed');
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to record customer FX settlement',
    };
  }
}

export async function recordAgentFxSettlementAction(
  input: z.infer<typeof agentFxSettlementSchema>,
  branchSlug?: string,
) {
  try {
    const access = await assertFxSettlementWriteAccess(branchSlug);
    if (access.error) return { success: false as const, error: access.error };

    const parsed = agentFxSettlementSchema.parse(input);
    const agentSales = await loadAgentUnsettledSales(parsed.collectionAccountId);
    if (agentSales.length === 0) {
      return { success: false as const, error: 'No unsettled balance for this collection agent' };
    }

    const groupLines = sortSalesFifo(agentSales.map(toFxOpenSaleLine));
    const allocations = buildFifoAllocations(
      groupLines,
      parsed.paidForeign,
      parsed.settlementRate,
    );

    return recordBatchFxSettlementAction(
      {
        collectionAccountId: parsed.collectionAccountId,
        toAccountId: parsed.toAccountId,
        allocations,
        settledAt: parsed.settledAt,
        notes: parsed.notes,
      },
      branchSlug,
    );
  } catch (err) {
    logger.error({ err, input }, 'recordAgentFxSettlementAction failed');
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to record agent FX settlement',
    };
  }
}

async function consumeWalletAllocationsForSale(
  client: { query: typeof query },
  collectionAccountId: string,
  saleId: string,
  amount: number,
): Promise<Array<{ walletAllocationId: string; amount: number; saleConversionRate: number }>> {
  const rowsRes = await client.query(
    `SELECT id, allocated_foreign, settled_foreign, sale_conversion_rate
     FROM ic_wallet_sale_allocations
     WHERE collection_account_id = $1 AND sale_id = $2
       AND allocated_foreign - settled_foreign > 0.0001
     ORDER BY created_at ASC, id ASC`,
    [collectionAccountId, saleId],
  );

  let pool = amount;
  const chunks: Array<{ walletAllocationId: string; amount: number; saleConversionRate: number }> = [];
  for (const row of rowsRes.rows) {
    if (pool <= 1e-10) break;
    const unsettled = roundFxCalc(Number(row.allocated_foreign) - Number(row.settled_foreign));
    const applied = roundFxCalc(Math.min(pool, unsettled));
    if (applied <= 1e-10) continue;
    chunks.push({
      walletAllocationId: String(row.id),
      amount: applied,
      saleConversionRate: Number(row.sale_conversion_rate),
    });
    pool = roundFxCalc(pool - applied);
  }

  if (pool > 1e-10) {
    throw new Error('Insufficient agent balance on one or more sales');
  }
  return chunks;
}

async function runBatchFxSettlementInTx(
  client: { query: typeof query },
  parsed: z.infer<typeof batchSettlementSchema>,
  user: { email?: string | null; name?: string | null } | null,
  batchId: string,
): Promise<{ ids: string[]; closing: ReturnType<typeof computeAgentGroupClosingSummary> }> {
  await assertCollectionAgentAccount(client, parsed.collectionAccountId);
  await assertFxSettlementPayToAccount(client, parsed.toAccountId, parsed.collectionAccountId);

  const lockAccountIds = sortedIds([parsed.collectionAccountId, parsed.toAccountId]);
  await client.query(
    `SELECT id FROM ic_fund_accounts WHERE id = ANY($1::varchar[]) ORDER BY id FOR UPDATE`,
    [lockAccountIds],
  );

  await client.query(
    `SELECT id FROM ic_wallet_sale_allocations
     WHERE collection_account_id = $1
       AND allocated_foreign - settled_foreign > 0.0001
     ORDER BY id
     FOR UPDATE`,
    [parsed.collectionAccountId],
  );

  await applyUnappliedCreditsForAgent(client, parsed.collectionAccountId);

  const agentRes = await client.query(
    `SELECT name FROM ic_fund_accounts WHERE id = $1 LIMIT 1`,
    [parsed.collectionAccountId],
  );
  const agentName = String(agentRes.rows[0]?.name || 'Collection agent');

  const groupSales = await loadAgentUnsettledSales(parsed.collectionAccountId, client);
  const groupLines = groupSales.map(toFxOpenSaleLine);
  validateBatchFxAllocations(groupLines, parsed.allocations);
  const closing = computeAgentGroupClosingSummary(groupLines, parsed.allocations);

  const allocationSaleIds = sortedIds(parsed.allocations.map(a => a.saleId));
  const salesRes = await client.query(
    `SELECT * FROM ic_sales WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
    [allocationSaleIds],
  );
  if (salesRes.rows.length !== allocationSaleIds.length) {
    throw new Error('One or more sales were not found');
  }

  const saleMap = new Map<string, Record<string, unknown>>();
  for (const row of salesRes.rows) {
    const sale = row;
    saleMap.set(String(sale.id), sale);
    if (String(sale.order_status) !== 'completed') {
      throw new Error('FX settlement requires completed sales');
    }
    if (!isForeignCurrencySale(sale.currency, sale.conversion_rate)) {
      throw new Error('One or more sales have no foreign currency exposure');
    }
  }

  const customerSourceIds = sortedIds(
    [...saleMap.values()]
      .map(sale => (sale.order_customer_id ? String(sale.order_customer_id) : ''))
      .filter(Boolean),
  );
  await client.query(
    `SELECT id FROM ic_fund_accounts
     WHERE id = ANY($1::varchar[])
        OR (source_type = 'ic_system' AND source_id = 'ic_fx_profit')
        OR (cardinality($2::varchar[]) > 0 AND source_type = 'ic_customer' AND source_id = ANY($2::varchar[]))
     ORDER BY id
     FOR UPDATE`,
    [lockAccountIds, customerSourceIds],
  );

  const ids: string[] = [];
  const voucherDate = parsed.settledAt
    ? new Date(parsed.settledAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  for (const alloc of parsed.allocations) {
    const sale = saleMap.get(alloc.saleId)!;
    const chunks = await consumeWalletAllocationsForSale(
      client,
      parsed.collectionAccountId,
      alloc.saleId,
      alloc.paidForeign,
    );

    for (const chunk of chunks) {
      const computed = computeSaleFxSettlementAmounts(
        chunk.amount,
        alloc.settlementRate,
        chunk.saleConversionRate,
      );

      const insertRes = await client.query(
        `INSERT INTO ic_sale_fx_settlements (
           sale_id, collection_account_id, wallet_allocation_id, currency, batch_id,
           paid_foreign, settlement_rate, sale_conversion_rate,
           settled_aed, booked_aed, type2_profit_aed,
           settled_at, notes, entered_by, entered_by_name, to_account_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING id`,
        [
          alloc.saleId,
          parsed.collectionAccountId,
          chunk.walletAllocationId,
          String(sale.currency).toUpperCase(),
          batchId,
          computed.paidForeign,
          computed.settlementRate,
          computed.saleConversionRate,
          computed.settledAed,
          computed.bookedAed,
          computed.type2ProfitAed,
          parsed.settledAt ? new Date(parsed.settledAt) : new Date(),
          parsed.notes || null,
          user?.email || 'system',
          user?.name || 'System',
          parsed.toAccountId,
        ],
      );
      ids.push(String(insertRes.rows[0].id));

      const updated = await client.query(
        `UPDATE ic_wallet_sale_allocations
         SET settled_foreign = settled_foreign + $1
         WHERE id = $2
           AND settled_foreign + $1 <= allocated_foreign + 0.0001
         RETURNING id`,
        [chunk.amount, chunk.walletAllocationId],
      );
      if (updated.rows.length === 0) {
        throw new Error('Wallet allocation changed during settlement');
      }
    }
  }

  let totalReceiptAed = 0;
  for (const id of ids) {
    const posted = await syncSaleFxSettlementLedgerInTx(client, id);
    totalReceiptAed = roundLedgerAmount(totalReceiptAed + posted.receiptAmount);
  }

  const paymentVoucherId = await postFxSettlementBatchPaymentInTx(client, {
    batchId,
    collectionAccountId: parsed.collectionAccountId,
    toAccountId: parsed.toAccountId,
    amount: totalReceiptAed,
    voucherDate,
    agentName,
    notes: parsed.notes,
  });

  if (paymentVoucherId) {
    await client.query(
      `UPDATE ic_sale_fx_settlements
       SET payment_voucher_id = $1
       WHERE batch_id = $2`,
      [paymentVoucherId, batchId],
    );
  }

  return { ids, closing };
}

export async function recordBatchFxSettlementAction(
  input: z.infer<typeof batchSettlementSchema>,
  branchSlug?: string,
) {
  try {
    const access = await assertFxSettlementWriteAccess(branchSlug);
    if (access.error) return { success: false as const, error: access.error };

    const parsed = batchSettlementSchema.parse(input);
    const batchId = randomUUID();
    const result = await withTransaction(async client =>
      runBatchFxSettlementInTx(client, parsed, access.user, batchId),
    );

    return {
      success: true as const,
      batchId,
      settlementIds: result.ids,
      closing: result.closing,
    };
  } catch (err) {
    logger.error({ err, input }, 'recordBatchFxSettlementAction failed');
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to record batch FX settlement',
    };
  }
}

const FX_SETTLEMENT_LIST_COLUMNS = `
  f.id,
  f.sale_id,
  f.collection_account_id,
  f.currency,
  f.paid_foreign,
  f.settlement_rate,
  f.type2_profit_aed,
  f.settled_at,
  f.created_at,
  a.name AS collection_account_name,
  s.customer_name,
  s.order_customer_name,
  s.order_customer_id,
  cb.slug AS customer_branch_slug
`;

function mapSettlementListRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    saleId: String(row.sale_id),
    collectionAccountId: row.collection_account_id ? String(row.collection_account_id) : undefined,
    currency: String(row.currency),
    paidForeign: Number(row.paid_foreign),
    settlementRate: Number(row.settlement_rate),
    type2ProfitAed: Number(row.type2_profit_aed),
    settledAt: row.settled_at ? new Date(String(row.settled_at)).toISOString() : undefined,
    collectionAccountName: row.collection_account_name ? String(row.collection_account_name) : undefined,
    customerName: String(row.order_customer_name || row.customer_name || ''),
    customerId: row.order_customer_id ? String(row.order_customer_id) : undefined,
    customerBranchSlug: row.customer_branch_slug ? String(row.customer_branch_slug) : undefined,
  };
}

export async function getSaleFxSettlementsPageAction(params?: {
  branchSlug?: string;
  limit?: number;
  offset?: number;
}) {
  try {
    const user = await getSessionUser(params?.branchSlug);
    if (!user || user.role === 'customer') {
      return { success: false as const, error: 'Unauthorized' };
    }

    const limit = Math.min(Math.max(params?.limit ?? FX_SETTLEMENT_LIST_PAGE_SIZE, 1), 100);
    const offset = Math.max(params?.offset ?? 0, 0);

    const [pageRes, totalsRes] = await runQueryBatch(
      [
        () =>
          query(
            `SELECT ${FX_SETTLEMENT_LIST_COLUMNS},
               COUNT(*) OVER()::int AS _total_count
             FROM ic_sale_fx_settlements f
             JOIN ic_sales s ON s.id = f.sale_id
             LEFT JOIN ic_fund_accounts a ON a.id = f.collection_account_id
             LEFT JOIN customers oc ON oc.id = s.order_customer_id
             LEFT JOIN branches cb ON cb.id = oc.branch_id
             ORDER BY f.settled_at DESC, f.created_at DESC
             LIMIT $1 OFFSET $2`,
            [limit, offset],
          ),
        () =>
          query(
            `SELECT COALESCE(SUM(type2_profit_aed), 0) AS total_type2
             FROM ic_sale_fx_settlements`,
          ),
      ],
      2,
    );

    const total =
      pageRes.rows.length > 0
        ? Number((pageRes.rows[0] as Record<string, unknown>)._total_count) || 0
        : 0;
    const settlements = pageRes.rows.map(row => mapSettlementListRow(row as Record<string, unknown>));
    const totalType2 = Number(totalsRes.rows[0]?.total_type2) || 0;

    return {
      success: true as const,
      settlements,
      total,
      totalType2,
    };
  } catch (err) {
    logger.error({ err }, 'getSaleFxSettlementsPageAction failed');
    return { success: false as const, error: 'Failed to load FX settlements' };
  }
}

export async function listSaleFxSettlementsAction(saleId?: string, branchSlug?: string) {
  try {
    const user = await getSessionUser(branchSlug);
    if (!user || user.role === 'customer') {
      return { success: false as const, error: 'Unauthorized' };
    }

    const params: unknown[] = [];
    let where = 'WHERE 1=1';
    if (saleId) {
      params.push(saleId);
      where += ` AND f.sale_id = $${params.length}`;
    }

    const res = await query(
      `SELECT f.*, a.name AS collection_account_name, s.customer_name, s.order_customer_name
       FROM ic_sale_fx_settlements f
       JOIN ic_sales s ON s.id = f.sale_id
       LEFT JOIN ic_fund_accounts a ON a.id = f.collection_account_id
       ${where}
       ORDER BY f.settled_at DESC, f.created_at DESC
       LIMIT 500`,
      params,
    );

    return {
      success: true as const,
      settlements: res.rows.map(row => ({
        ...mapSettlementRow(row),
        collectionAccountName: row.collection_account_name ? String(row.collection_account_name) : undefined,
        customerName: String(row.order_customer_name || row.customer_name || ''),
      })),
    };
  } catch (err) {
    logger.error({ err, saleId }, 'listSaleFxSettlementsAction failed');
    return { success: false as const, error: 'Failed to load FX settlements' };
  }
}

export async function getSaleFxSettlementSummaryAction(saleId: string) {
  try {
    const res = await query(
      `SELECT s.currency, s.conversion_rate, s.converted_amount, s.payment_status,
              COALESCE(wallet_paid.total_paid, 0) AS foreign_collected,
              COALESCE(SUM(f.type2_profit_aed), 0) AS total_type2_profit
       FROM ic_sales s
       ${WALLET_PAID_LATERAL}
       LEFT JOIN ic_sale_fx_settlements f ON f.sale_id = s.id
       WHERE s.id = $1
       GROUP BY s.id, s.currency, s.conversion_rate, s.converted_amount, s.payment_status,
                wallet_paid.total_paid`,
      [saleId],
    );
    if (res.rows.length === 0) return { success: false as const, error: 'Sale not found' };
    const row = res.rows[0];
    const convertedAmount = Number(row.converted_amount) || 0;
    const foreignCollected = Number(row.foreign_collected) || 0;
    return {
      success: true as const,
      summary: {
        currency: row.currency ? String(row.currency) : undefined,
        conversionRate: row.conversion_rate != null ? Number(row.conversion_rate) : undefined,
        convertedAmount,
        foreignCollected,
        foreignRemaining: remainingForeignOwed(convertedAmount, foreignCollected),
        totalType2Profit: Number(row.total_type2_profit) || 0,
        paymentStatus: String(row.payment_status || 'pending'),
        isForeign: isForeignCurrencySale(row.currency, row.conversion_rate),
      },
    };
  } catch (err) {
    logger.error({ err, saleId }, 'getSaleFxSettlementSummaryAction failed');
    return { success: false as const, error: 'Failed to load settlement summary' };
  }
}

const FX_CUSTOMER_OVERVIEW_SQL = `
  WITH wallet_paid AS (
    SELECT wsa.sale_id, COALESCE(SUM(wsa.allocated_foreign), 0) AS total_paid
    FROM ic_wallet_sale_allocations wsa
    JOIN ic_wallet_transactions wt ON wt.id = wsa.wallet_transaction_id AND wt.status = 'approved'
    GROUP BY wsa.sale_id
  ),
  customer_paid AS (
    SELECT wsa.customer_id, COALESCE(SUM(wsa.allocated_foreign), 0) AS total_paid_approved
    FROM ic_wallet_sale_allocations wsa
    JOIN ic_wallet_transactions wt ON wt.id = wsa.wallet_transaction_id AND wt.status = 'approved'
    GROUP BY wsa.customer_id
  ),
  open_sale_stats AS (
    SELECT
      s.order_customer_id AS customer_id,
      MAX(UPPER(COALESCE(s.currency, 'AED'))) AS sale_currency,
      COUNT(*)::int AS open_sale_count,
      COALESCE(SUM(COALESCE(s.converted_amount, 0)), 0) AS total_converted,
      COALESCE(
        SUM(GREATEST(COALESCE(s.converted_amount, 0) - COALESCE(wp.total_paid, 0), 0)),
        0
      ) AS foreign_remaining
    FROM ic_sales s
    LEFT JOIN wallet_paid wp ON wp.sale_id = s.id
    WHERE s.order_status = 'completed'
      AND s.order_customer_id IS NOT NULL
      AND UPPER(COALESCE(s.currency, 'AED')) NOT IN ('AED', 'CURRENCY')
      AND COALESCE(s.conversion_rate, 0) > 0
      AND COALESCE(s.converted_amount, 0) > 0
      AND COALESCE(wp.total_paid, 0) < COALESCE(s.converted_amount, 0) - 0.0001
    GROUP BY s.order_customer_id
  )
  SELECT
    c.id,
    c.name,
    UPPER(COALESCE(c.currency, 'AED')) AS profile_currency,
    b.name AS branch_name,
    b.slug AS branch_slug,
    oss.sale_currency,
    COALESCE(oss.open_sale_count, 0) AS open_sale_count,
    COALESCE(oss.foreign_remaining, 0) AS foreign_remaining,
    COALESCE(cp.total_paid_approved, 0) AS foreign_paid_approved,
    COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'collectionAccountId', cca.collection_account_id,
            'name', a.name,
            'currency', UPPER(COALESCE(a.currency, 'AED')),
            'isPrimary', cca.is_primary
          )
          ORDER BY cca.is_primary DESC, a.name ASC
        )
        FROM customer_collection_agents cca
        JOIN ic_fund_accounts a ON a.id = cca.collection_account_id
        WHERE cca.customer_id = c.id
      ),
      '[]'::json
    ) AS agents
  FROM customers c
  LEFT JOIN branches b ON b.id = c.branch_id
  LEFT JOIN open_sale_stats oss ON oss.customer_id = c.id
  LEFT JOIN customer_paid cp ON cp.customer_id = c.id
  WHERE c.status = 'active'
    AND ($1::text IS NULL OR b.slug = $1)
    AND (
      UPPER(COALESCE(c.currency, 'AED')) NOT IN ('AED', 'CURRENCY')
      OR oss.customer_id IS NOT NULL
    )
  ORDER BY COALESCE(oss.foreign_remaining, 0) DESC, LOWER(c.name) ASC
`;

export async function getFxPageOverviewAction(branchSlug?: string) {
  try {
    const user = await getSessionUser(branchSlug);
    if (!user || user.role === 'customer' || user.role === 'collection_agent') {
      return { success: false as const, error: 'Unauthorized' };
    }

    const branchFilter = branchSlug && branchSlug !== 'superadmin' ? branchSlug : null;

    const [customersRes, pendingRes, settlementReqRes, agentBalanceRes, type2Res] = await Promise.all([
      query(FX_CUSTOMER_OVERVIEW_SQL, [branchFilter]),
      query(`SELECT COUNT(*)::int AS count FROM ic_wallet_transactions WHERE status = 'pending'`),
      query(`SELECT COUNT(*)::int AS count FROM ic_fx_settlement_requests WHERE status = 'pending'`),
      query(
        `SELECT UPPER(COALESCE(wt.currency, a.currency, 'AED')) AS currency,
                COALESCE(SUM(wsa.allocated_foreign - wsa.settled_foreign), 0) AS total
         FROM ic_wallet_sale_allocations wsa
         JOIN ic_wallet_transactions wt ON wt.id = wsa.wallet_transaction_id AND wt.status = 'approved'
         JOIN ic_fund_accounts a ON a.id = wsa.collection_account_id
         WHERE wsa.allocated_foreign - wsa.settled_foreign > 0.0001
         GROUP BY 1`,
      ),
      query(`SELECT COALESCE(SUM(type2_profit_aed), 0) AS total FROM ic_sale_fx_settlements`),
    ]);

    type AgentLink = {
      collectionAccountId: string;
      name: string;
      currency: string;
      isPrimary: boolean;
    };

    const customers = customersRes.rows.map(row => {
      const profileCurrency = String(row.profile_currency || 'AED').toUpperCase();
      const saleCurrency = row.sale_currency ? String(row.sale_currency).toUpperCase() : undefined;
      const agentsRaw = row.agents;
      const agents: AgentLink[] = Array.isArray(agentsRaw)
        ? agentsRaw.map((a: Record<string, unknown>) => ({
            collectionAccountId: String(a.collectionAccountId),
            name: String(a.name),
            currency: String(a.currency || 'AED').toUpperCase(),
            isPrimary: Boolean(a.isPrimary),
          }))
        : [];
      const foreignRemaining = Number(row.foreign_remaining) || 0;
      const foreignPaidApproved = Number(row.foreign_paid_approved) || 0;
      const openSaleCount = Number(row.open_sale_count) || 0;
      const needsProfileCurrency =
        profileCurrency === 'AED' && Boolean(saleCurrency && saleCurrency !== 'AED');
      const effectiveCurrency = profileCurrency !== 'AED' ? profileCurrency : saleCurrency || profileCurrency;

      let status: 'ready' | 'needs_agents' | 'needs_payment' | 'needs_profile' | 'idle' = 'idle';
      if (needsProfileCurrency) status = 'needs_profile';
      else if (foreignRemaining > 0.0001 && agents.length === 0) status = 'needs_agents';
      else if (foreignRemaining > 0.0001 && agents.length > 0) status = 'needs_payment';
      else if (agents.length > 0) status = 'ready';

      return {
        id: String(row.id),
        name: String(row.name),
        branchName: row.branch_name ? String(row.branch_name) : undefined,
        branchSlug: row.branch_slug ? String(row.branch_slug) : undefined,
        profileCurrency,
        saleCurrency,
        effectiveCurrency,
        agents,
        foreignRemaining,
        foreignPaidApproved,
        openSaleCount,
        needsProfileCurrency,
        status,
      };
    });

    const foreignByCurrency = aggregateByCurrency(
      customers.filter(c => c.foreignRemaining > 1e-10),
      c => c.effectiveCurrency,
      c => c.foreignRemaining,
    );

    const agentByCurrency: Record<string, number> = {};
    for (const row of agentBalanceRes.rows) {
      const cur = String(row.currency || 'AED').toUpperCase();
      agentByCurrency[cur] = roundFxCalc(Number(row.total) || 0);
    }

    const stats = {
      customerCount: customers.length,
      customersWithoutAgents: customers.filter(c => c.status === 'needs_agents').length,
      customersNeedingProfile: customers.filter(c => c.status === 'needs_profile').length,
      pendingPayments: Number(pendingRes.rows[0]?.count) || 0,
      pendingSettlementRequests: Number(settlementReqRes.rows[0]?.count) || 0,
      foreignByCurrency,
      agentByCurrency,
      /** @deprecated use foreignByCurrency — kept for compat, only valid when single currency */
      totalForeignRemaining: roundFxCalc(
        customers.reduce((sum, c) => sum + c.foreignRemaining, 0),
      ),
      totalAgentBalance: roundFxCalc(
        Object.values(agentByCurrency).reduce((s, v) => s + v, 0),
      ),
      totalType2Booked: roundFxCalc(Number(type2Res.rows[0]?.total) || 0),
    };

    return { success: true as const, stats, customers };
  } catch (err) {
    logger.error({ err }, 'getFxPageOverviewAction failed');
    return { success: false as const, error: 'Failed to load FX overview' };
  }
}

const fxSettlementRequestSchema = z.object({
  paidForeign: positiveFormAmountSchema,
  agentNotes: z.string().trim().optional().nullable(),
});

const approveFxSettlementRequestSchema = z.object({
  requestId: z.string().uuid(),
  settlementRate: positiveFormAmountSchema,
  toAccountId: z.string().trim().min(1),
  notes: z.string().trim().optional().nullable(),
});

function mapSettlementRequestRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    collectionAccountId: String(row.collection_account_id),
    collectionAccountName: row.collection_account_name ? String(row.collection_account_name) : undefined,
    paidForeign: Number(row.paid_foreign),
    currency: String(row.currency),
    settlementRate: row.settlement_rate != null ? Number(row.settlement_rate) : undefined,
    settledAed: row.settled_aed != null ? Number(row.settled_aed) : undefined,
    status: String(row.status) as 'pending' | 'approved' | 'rejected',
    agentNotes: row.agent_notes ? String(row.agent_notes) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    enteredByName: row.entered_by_name ? String(row.entered_by_name) : undefined,
    reviewedByName: row.reviewed_by_name ? String(row.reviewed_by_name) : undefined,
    reviewedAt: row.reviewed_at ? new Date(String(row.reviewed_at)).toISOString() : undefined,
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : undefined,
  };
}

async function resolveCollectionAgentForUser(user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>) {
  if (user.role !== 'collection_agent' || !user.collectionAccountId) {
    throw new Error('Not linked to a collection agent account');
  }
  const res = await query(
    `SELECT a.id, a.name, a.currency, a.status, a.branch_id
     FROM ic_fund_accounts a
     WHERE a.id = $1 AND a.account_type = 'collection_agent'
     LIMIT 1`,
    [user.collectionAccountId],
  );
  if (res.rows.length === 0) throw new Error('Collection agent account not found');
  if (String(res.rows[0].status) !== 'active') throw new Error('Collection agent account is inactive');
  return {
    id: String(res.rows[0].id),
    name: String(res.rows[0].name),
    currency: String(res.rows[0].currency).toUpperCase(),
    branchId: String(res.rows[0].branch_id),
  };
}

export async function getCollectionAgentFxDashboardAction(branchSlug?: string) {
  try {
    const user = await getSessionUser(branchSlug);
    if (!user || user.role !== 'collection_agent') {
      return { success: false as const, error: 'Unauthorized' };
    }

    const agent = await resolveCollectionAgentForUser(user);
    const sales = await loadAgentUnsettledSales(agent.id);
    const lines = sortSalesFifo(sales.map(toFxOpenSaleLine));
    const closing = sales.length ? computeAgentGroupClosingSummary(lines, []) : null;

    const pendingRes = await query(
      `SELECT COUNT(*)::int AS count
       FROM ic_fx_settlement_requests
       WHERE collection_account_id = $1 AND status = 'pending'`,
      [agent.id],
    );

    const historyRes = await query(
      `SELECT r.*, a.name AS collection_account_name
       FROM ic_fx_settlement_requests r
       JOIN ic_fund_accounts a ON a.id = r.collection_account_id
       WHERE r.collection_account_id = $1
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [agent.id],
    );

    return {
      success: true as const,
      agent: {
        id: agent.id,
        name: agent.name,
        currency: agent.currency,
        agentBalance: closing?.totalSarRemaining ?? 0,
        closing: closing
          ? {
              totalSarRemaining: closing.totalSarRemaining,
              avgSaleRateAed: closing.avgSaleRateAed,
              avgSaleConversionRate: closing.avgSaleConversionRate,
              totalAed: closing.totalAed,
            }
          : null,
      },
      sales: sales.map(s => ({
        id: s.id,
        customerName: s.customerName,
        units: s.units,
        unitRate: s.unitRate,
        aedAmount: s.aedAmount,
        conversionRate: s.conversionRate,
        foreignRemaining: s.foreignRemaining,
        createdAt: s.createdAt,
      })),
      pendingRequestCount: Number(pendingRes.rows[0]?.count) || 0,
      requests: historyRes.rows.map(mapSettlementRequestRow),
    };
  } catch (err) {
    logger.error({ err }, 'getCollectionAgentFxDashboardAction failed');
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to load agent dashboard',
    };
  }
}

export async function submitFxSettlementRequestAction(
  input: z.infer<typeof fxSettlementRequestSchema>,
  branchSlug?: string,
) {
  try {
    const user = await getSessionUser(branchSlug);
    if (!user || user.role !== 'collection_agent') {
      return { success: false as const, error: 'Unauthorized' };
    }

    const parsed = fxSettlementRequestSchema.parse(input);
    const agent = await resolveCollectionAgentForUser(user);

    const requestId = await withTransaction(async client => {
      await client.query(
        `SELECT id FROM ic_wallet_sale_allocations
         WHERE collection_account_id = $1
           AND allocated_foreign - settled_foreign > 0.0001
         ORDER BY id
         FOR UPDATE`,
        [agent.id],
      );

      const sales = await loadAgentUnsettledSales(agent.id, client);
      if (sales.length === 0) {
        throw new Error('No unsettled balance to remit');
      }

      const lines = sortSalesFifo(sales.map(toFxOpenSaleLine));
      const opening = computeAgentGroupClosingSummary(lines, []);
      if (parsed.paidForeign > opening.totalSarRemaining + 1e-10) {
        throw new Error(
          `Amount exceeds held balance (${formatFxAmount(opening.totalSarRemaining)} ${agent.currency})`,
        );
      }

      const pendingRes = await client.query(
        `SELECT id FROM ic_fx_settlement_requests
         WHERE collection_account_id = $1 AND status = 'pending'
         LIMIT 1
         FOR UPDATE`,
        [agent.id],
      );
      if (pendingRes.rows.length > 0) {
        throw new Error('You already have a pending remittance request');
      }

      const insertRes = await client.query(
        `INSERT INTO ic_fx_settlement_requests (
           collection_account_id, paid_foreign, currency, status,
           agent_notes, entered_by, entered_by_name
         ) VALUES ($1,$2,$3,'pending',$4,$5,$6)
         RETURNING id`,
        [
          agent.id,
          parsed.paidForeign,
          agent.currency,
          parsed.agentNotes || null,
          user.email || 'agent',
          user.name || 'Collection agent',
        ],
      );
      return String(insertRes.rows[0].id);
    });

    return { success: true as const, requestId };
  } catch (err) {
    logger.error({ err, input }, 'submitFxSettlementRequestAction failed');
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to submit remittance request',
    };
  }
}

export async function listPendingFxSettlementRequestsAction(branchSlug?: string) {
  try {
    const access = await assertFxSettlementWriteAccess(branchSlug);
    if (access.error) return { success: false as const, error: access.error };

    const res = await query(
      `SELECT r.*, a.name AS collection_account_name
       FROM ic_fx_settlement_requests r
       JOIN ic_fund_accounts a ON a.id = r.collection_account_id
       WHERE r.status = 'pending'
       ORDER BY r.created_at ASC
       LIMIT 100`,
    );

    const requests = await Promise.all(
      res.rows.map(async row => {
        const agentId = String(row.collection_account_id);
        const sales = await loadAgentUnsettledSales(agentId);
        const lines = sortSalesFifo(sales.map(toFxOpenSaleLine));
        const opening = sales.length ? computeAgentGroupClosingSummary(lines, []) : null;
        return {
          ...mapSettlementRequestRow(row),
          agentBalance: opening?.totalSarRemaining ?? 0,
          avgSaleFx: opening?.avgSaleConversionRate ?? 0,
          saleCount: sales.length,
        };
      }),
    );

    return { success: true as const, requests };
  } catch (err) {
    logger.error({ err }, 'listPendingFxSettlementRequestsAction failed');
    return { success: false as const, error: 'Failed to load pending remittance requests' };
  }
}

export async function approveFxSettlementRequestAction(
  input: z.infer<typeof approveFxSettlementRequestSchema>,
  branchSlug?: string,
) {
  try {
    const access = await assertFxSettlementWriteAccess(branchSlug);
    if (access.error) return { success: false as const, error: access.error };
    const user = access.user;
    const parsed = approveFxSettlementRequestSchema.parse(input);
    const batchId = randomUUID();

    const paidForeign = await withTransaction(async client => {
      const reqRes = await client.query(
        `SELECT * FROM ic_fx_settlement_requests WHERE id = $1 FOR UPDATE`,
        [parsed.requestId],
      );
      if (reqRes.rows.length === 0) throw new Error('Pending request not found');
      const req = reqRes.rows[0];
      if (String(req.status) !== 'pending') throw new Error('Request is not pending');

      const collectionAccountId = String(req.collection_account_id);
      const paid = Number(req.paid_foreign);

      const agentSales = await loadAgentUnsettledSales(collectionAccountId, client);
      if (agentSales.length === 0) {
        throw new Error('No unsettled balance for this collection agent');
      }
      const allocations = buildFifoAllocations(
        sortSalesFifo(agentSales.map(toFxOpenSaleLine)),
        paid,
        parsed.settlementRate,
      );
      const closing = computeAgentGroupClosingSummary(
        agentSales.map(toFxOpenSaleLine),
        allocations,
      );

      await runBatchFxSettlementInTx(
        client,
        {
          collectionAccountId,
          toAccountId: parsed.toAccountId,
          allocations,
          notes: parsed.notes,
        },
        user,
        batchId,
      );

      await client.query(
        `UPDATE ic_fx_settlement_requests
         SET status = 'approved',
             settlement_rate = $2,
             settled_aed = $3,
             to_account_id = $4,
             batch_id = $5,
             notes = COALESCE($6, notes),
             reviewed_by = $7,
             reviewed_by_name = $8,
             reviewed_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = 'pending'`,
        [
          parsed.requestId,
          parsed.settlementRate,
          closing.settledAed,
          parsed.toAccountId,
          batchId,
          parsed.notes || null,
          user?.email || 'admin',
          user?.name || 'Admin',
        ],
      );

      return paid;
    });

    return { success: true as const, batchId, paidForeign };
  } catch (err) {
    logger.error({ err, input }, 'approveFxSettlementRequestAction failed');
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to approve remittance request',
    };
  }
}

export async function rejectFxSettlementRequestAction(
  input: { requestId: string; reason?: string | null },
  branchSlug?: string,
) {
  try {
    const access = await assertFxSettlementWriteAccess(branchSlug);
    if (access.error) return { success: false as const, error: access.error };
    const user = access.user;

    const res = await query(
      `UPDATE ic_fx_settlement_requests
       SET status = 'rejected',
           rejection_reason = $2,
           reviewed_by = $3,
           reviewed_by_name = $4,
           reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'pending'
       RETURNING id`,
      [
        input.requestId,
        input.reason?.trim() || null,
        user?.email || 'admin',
        user?.name || 'Admin',
      ],
    );
    if (res.rows.length === 0) {
      return { success: false as const, error: 'Pending request not found' };
    }
    return { success: true as const };
  } catch (err) {
    logger.error({ err, input }, 'rejectFxSettlementRequestAction failed');
    return { success: false as const, error: 'Failed to reject remittance request' };
  }
}
