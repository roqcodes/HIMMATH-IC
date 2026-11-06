import 'server-only';

import type { QueryResult } from 'pg';
import { query, withTransaction, sortedIds } from '@/lib/db';
import { validateVoucherAccounts } from '@/lib/icFunds/voucherRules';
import { validateVoucherCurrencyPolicy, roundLedgerAmount, IC_FUNDS_BASE_CURRENCY } from '@/lib/icFunds/currencyPolicy';
import { ensureHqIcFundsBranch } from '@/lib/icFunds/ensureHqBranch';
import { HQ_IC_FUNDS_BRANCH_ID } from '@/lib/icFunds/hqBranch';
import {
  addPurchaseToPool,
  compareInventoryEvents,
  consumeSaleFromPool,
  computeSaleMargin,
  purchaseAedTotal,
  resolveSaleMarginFromPool,
  type RemainingStockPool,
  type WarehouseInventoryEvent,
} from '@/lib/icFunds/warehouseProfit';
import { IC_SALE_VOID_ORDER_STATUSES } from '@/lib/icFunds/icTransferReportFilters';
import { logger } from '@/lib/logger';

type DbClient = {
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
};

const db: DbClient = { query };

export type ICFundAccountSourceType = 'ic_supplier' | 'ic_warehouse' | 'ic_customer' | 'ic_counterparty';

const SALE_GHOST_STATUSES = new Set([
  'accepted',
  'wh_processing',
  'delivery_pending_admin',
]);
const SALE_VOID_STATUSES = new Set<string>(IC_SALE_VOID_ORDER_STATUSES);
const STARTER_TILLS = ['Collection', 'Fund', 'Cashier'] as const;
const SYNC_ACTOR = 'IC Transfer sync';

async function lockFundAccounts(
  client: DbClient,
  accountIds: string[],
  branchId: string,
) {
  const ids = sortedIds(accountIds);
  if (ids.length === 0) return [];
  const accounts = await client.query(
    `SELECT id, account_type, status FROM ic_fund_accounts
     WHERE id = ANY($1::varchar[]) AND branch_id = $2
     ORDER BY id
     FOR UPDATE`,
    [ids, branchId],
  );
  return accounts.rows;
}

function isoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value ?? '');
  return raw.length >= 10 ? raw.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function accountDisplayName(sourceType: ICFundAccountSourceType, name: string): string {
  if (sourceType === 'ic_warehouse') return `Warehouse: ${name}`;
  return name.trim();
}

async function ensureStarterTills(client: DbClient, branchId: string): Promise<void> {
  const ids = STARTER_TILLS.map(() => `ICFA-${crypto.randomUUID().slice(0, 10).toUpperCase()}`);
  await client.query(
    `INSERT INTO ic_fund_accounts (id, branch_id, name, account_type, opening_balance, notes)
     SELECT v.id, $1, v.name, 'bank', 0, 'Auto-seeded for IC Transfer'
     FROM unnest($2::text[], $3::text[]) AS v(id, name)
     WHERE NOT EXISTS (
       SELECT 1 FROM ic_fund_accounts a
       WHERE a.branch_id = $1 AND LOWER(TRIM(a.name)) = LOWER(TRIM(v.name))
     )`,
    [branchId, ids, [...STARTER_TILLS]],
  );
}

/** Unique violations abort the whole Postgres transaction unless rolled to a savepoint. */
async function insertIgnoringUnique(
  client: DbClient,
  savepoint: string,
  sql: string,
  params: unknown[],
): Promise<boolean> {
  let usedSavepoint = false;
  try {
    await client.query(`SAVEPOINT ${savepoint}`);
    usedSavepoint = true;
  } catch {
    usedSavepoint = false;
  }
  try {
    await client.query(sql, params);
    if (usedSavepoint) await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    return true;
  } catch (err) {
    if (usedSavepoint) {
      await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    }
    if ((err as { code?: string }).code === '23505') return false;
    throw err;
  }
}

export async function ensureLinkedAccount(
  client: DbClient,
  params: {
    branchId: string;
    sourceType: ICFundAccountSourceType;
    sourceId: string;
    name: string;
    phone?: string | null;
  },
): Promise<string | null> {
  if (!params.name.trim()) return null;
  const sourceId = params.sourceId.slice(0, 50);
  const displayName = accountDisplayName(params.sourceType, params.name);

  const existing = await client.query(
    `SELECT id FROM ic_fund_accounts
     WHERE branch_id = $1 AND (
       (source_type = $2 AND source_id = $3)
       OR (account_type = 'personal' AND LOWER(TRIM(name)) = LOWER(TRIM($4)))
     )
     ORDER BY CASE WHEN source_type = $2 AND source_id = $3 THEN 0 ELSE 1 END
     LIMIT 1`,
    [params.branchId, params.sourceType, sourceId, displayName],
  );
  if (existing.rows.length > 0) {
    const accountId = String(existing.rows[0].id);
    await client.query(
      `UPDATE ic_fund_accounts
       SET source_type = COALESCE(source_type, $1),
           source_id = COALESCE(source_id, $2),
           phone = COALESCE($3, phone)
       WHERE id = $4`,
      [params.sourceType, sourceId, params.phone || null, accountId],
    );
    return accountId;
  }

  const id = `ICFA-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
  const insertSql = `INSERT INTO ic_fund_accounts (
         id, branch_id, name, account_type, opening_balance, notes,
         source_type, source_id, phone
       ) VALUES ($1, $2, $3, 'personal', 0, $4, $5, $6, $7)`;
  const insertParams = [
    id,
    params.branchId,
    displayName,
    `Auto-synced from IC Transfer (${params.sourceType.replace('ic_', '')})`,
    params.sourceType,
    sourceId,
    params.phone || null,
  ];

  const inserted = await insertIgnoringUnique(client, 'sp_link_acct', insertSql, insertParams);
  if (inserted) return id;

  const byName = await client.query(
    `SELECT id FROM ic_fund_accounts
     WHERE branch_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))
     LIMIT 1`,
    [params.branchId, displayName],
  );
  if (byName.rows.length > 0) return String(byName.rows[0].id);

  const altName = `${displayName} [${sourceId.slice(0, 8)}]`;
  const altInserted = await insertIgnoringUnique(client, 'sp_link_acct_alt', insertSql, [
    id,
    params.branchId,
    altName,
    insertParams[3],
    insertParams[4],
    insertParams[5],
    insertParams[6],
  ]);
  if (altInserted) return id;

  const fallback = await client.query(
    `SELECT id FROM ic_fund_accounts
     WHERE branch_id = $1 AND source_type = $2 AND source_id = $3
     LIMIT 1`,
    [params.branchId, params.sourceType, sourceId],
  );
  return fallback.rows.length > 0 ? String(fallback.rows[0].id) : null;
}

async function ensureSystemAccount(
  client: DbClient,
  branchId: string,
  name: string,
  accountType: 'income' | 'd_expense' | 'profit' | 'personal',
  sourceId: string,
): Promise<string> {
  const existing = await client.query(
    `SELECT id, name FROM ic_fund_accounts
     WHERE branch_id = $1 AND source_type = 'ic_system' AND source_id = $2
     LIMIT 1`,
    [branchId, sourceId],
  );
  if (existing.rows.length > 0) {
    const id = String(existing.rows[0].id);
    if (String(existing.rows[0].name) !== name) {
      await client.query(`UPDATE ic_fund_accounts SET name = $1 WHERE id = $2`, [name, id]);
    }
    return id;
  }

  const byName = await client.query(
    `SELECT id FROM ic_fund_accounts
     WHERE branch_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))
     LIMIT 1`,
    [branchId, name],
  );
  if (byName.rows.length > 0) {
    const foundId = String(byName.rows[0].id);
    await client.query(
      `UPDATE ic_fund_accounts
       SET source_type = COALESCE(source_type, 'ic_system'),
           source_id = COALESCE(source_id, $1)
       WHERE id = $2`,
      [sourceId, foundId],
    );
    return foundId;
  }

  const id = `ICFA-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
  const inserted = await insertIgnoringUnique(
    client,
    'sp_sys_acct',
    `INSERT INTO ic_fund_accounts (
       id, branch_id, name, account_type, opening_balance, notes, source_type, source_id
     ) VALUES ($1, $2, $3, $4, 0, 'Auto-seeded for IC Transfer', 'ic_system', $5)`,
    [id, branchId, name, accountType, sourceId],
  );
  if (inserted) return id;

  const retry = await client.query(
    `SELECT id FROM ic_fund_accounts
     WHERE branch_id = $1 AND (
       (source_type = 'ic_system' AND source_id = $2)
       OR LOWER(TRIM(name)) = LOWER(TRIM($3))
     )
     LIMIT 1`,
    [branchId, sourceId, name],
  );
  if (retry.rows.length === 0) {
    throw new Error(`Could not ensure IC Funds system account ${name}`);
  }
  return String(retry.rows[0].id);
}

async function resolveBankTillAccount(
  client: DbClient,
  branchId: string,
  bankHint?: string | null,
): Promise<string | null> {
  await ensureStarterTills(client, branchId);
  const hint = bankHint?.trim();
  if (hint) {
    const match = await client.query(
      `SELECT id FROM ic_fund_accounts
       WHERE branch_id = $1 AND account_type = 'bank' AND status = 'active'
         AND LOWER(TRIM(name)) = LOWER(TRIM($2))
       LIMIT 1`,
      [branchId, hint],
    );
    if (match.rows.length > 0) return String(match.rows[0].id);
  }
  for (const fallback of STARTER_TILLS) {
    const res = await client.query(
      `SELECT id FROM ic_fund_accounts
       WHERE branch_id = $1 AND account_type = 'bank' AND status = 'active'
         AND LOWER(TRIM(name)) = LOWER(TRIM($2))
       LIMIT 1`,
      [branchId, fallback],
    );
    if (res.rows.length > 0) return String(res.rows[0].id);
  }
  const any = await client.query(
    `SELECT id FROM ic_fund_accounts
     WHERE branch_id = $1 AND account_type = 'bank' AND status = 'active'
     ORDER BY LOWER(name) LIMIT 1`,
    [branchId],
  );
  return any.rows.length > 0 ? String(any.rows[0].id) : null;
}

/** INR metal → IC units is warehouse stock only. No AED cash moved, so no AED journal. */
async function voidMetalCashIcStockVoucher(
  client: DbClient,
  saleId: string,
  branchId: string,
): Promise<void> {
  await voidVoucherByReference(client, branchId, 'metal_sale_ic_stock', saleId);
}

async function voidSaleMarginVouchers(
  client: DbClient,
  branchId: string,
  saleId: string,
): Promise<void> {
  await voidVoucherByReference(client, branchId, 'ic_sale_cogs', saleId);
  await voidVoucherByReference(client, branchId, 'ic_sale_profit', saleId);
}

async function loadWarehouseInventoryEvents(
  client: DbClient,
  warehouseId: string,
  excludeSaleId: string,
  asOf: unknown,
): Promise<WarehouseInventoryEvent[]> {
  const purchasesRes = await client.query(
    `SELECT id, units, unit_rate, aed_total, created_at
     FROM ic_purchases
     WHERE warehouse_id = $1 AND created_at <= $2::timestamptz
       AND COALESCE(settlement_mode, 'cash') <> 'metal'
     ORDER BY created_at ASC, id ASC`,
    [warehouseId, asOf],
  );

  const salesRes = await client.query(
    `SELECT id, units, unit_rate, aed_amount, service_charge, collected_units,
            created_at, COALESCE(status_updated_at, created_at) AS completed_at
     FROM ic_sales
     WHERE warehouse_id = $1
       AND order_status = 'completed'
       AND COALESCE(settlement_mode, 'cash') <> 'metal'
       AND id <> $2::uuid
       AND COALESCE(status_updated_at, created_at) <= $3::timestamptz
     ORDER BY completed_at ASC, created_at ASC, id ASC`,
    [warehouseId, excludeSaleId, asOf],
  );

  const events: WarehouseInventoryEvent[] = [];

  for (const row of purchasesRes.rows) {
    const units = Number(row.units) || 0;
    events.push({
      kind: 'purchase',
      at: new Date(String(row.created_at)).getTime(),
      sortKey: String(row.id),
      units,
      cost: purchaseAedTotal(units, Number(row.unit_rate) || 0, row.aed_total),
    });
  }

  for (const row of salesRes.rows) {
    events.push({
      kind: 'sale',
      at: new Date(String(row.completed_at)).getTime(),
      sortKey: String(row.id),
      saleId: String(row.id),
      units: Number(row.units) || 0,
      collectedUnits: row.collected_units != null ? Number(row.collected_units) : null,
      unitRate: Number(row.unit_rate) || 0,
      aedAmount: Number(row.aed_amount) || 0,
      serviceCharge: Number(row.service_charge) || 0,
    });
  }

  await appendInrMetalConversionEvents(client, events, {
    warehouseId,
    excludeSaleId,
    asOf,
  });

  return events;
}

async function loadGlobalInventoryEvents(
  client: DbClient,
  excludeSaleId: string,
  asOf: unknown,
): Promise<WarehouseInventoryEvent[]> {
  const purchasesRes = await client.query(
    `SELECT id, units, unit_rate, aed_total, created_at
     FROM ic_purchases
     WHERE created_at <= $1::timestamptz
       AND COALESCE(settlement_mode, 'cash') <> 'metal'
     ORDER BY created_at ASC, id ASC`,
    [asOf],
  );

  const salesRes = await client.query(
    `SELECT id, units, unit_rate, aed_amount, service_charge, collected_units,
            created_at, COALESCE(status_updated_at, created_at) AS completed_at
     FROM ic_sales
     WHERE order_status = 'completed'
       AND COALESCE(settlement_mode, 'cash') <> 'metal'
       AND id <> $2::uuid
       AND COALESCE(status_updated_at, created_at) <= $3::timestamptz
     ORDER BY completed_at ASC, created_at ASC, id ASC`,
    [asOf, excludeSaleId, asOf],
  );

  const events: WarehouseInventoryEvent[] = [];

  for (const row of purchasesRes.rows) {
    const units = Number(row.units) || 0;
    events.push({
      kind: 'purchase',
      at: new Date(String(row.created_at)).getTime(),
      sortKey: String(row.id),
      units,
      cost: purchaseAedTotal(units, Number(row.unit_rate) || 0, row.aed_total),
    });
  }

  for (const row of salesRes.rows) {
    events.push({
      kind: 'sale',
      at: new Date(String(row.completed_at)).getTime(),
      sortKey: String(row.id),
      saleId: String(row.id),
      units: Number(row.units) || 0,
      collectedUnits: row.collected_units != null ? Number(row.collected_units) : null,
      unitRate: Number(row.unit_rate) || 0,
      aedAmount: Number(row.aed_amount) || 0,
      serviceCharge: Number(row.service_charge) || 0,
    });
  }

  await appendInrMetalConversionEvents(client, events, {
    warehouseId: null,
    excludeSaleId,
    asOf,
  });

  return events;
}

async function appendInrMetalConversionEvents(
  client: DbClient,
  events: WarehouseInventoryEvent[],
  params: { warehouseId: string | null; excludeSaleId: string; asOf: unknown },
): Promise<void> {
  const warehouseFilter = params.warehouseId ? 'AND s.warehouse_id = $3' : '';
  const queryParams = params.warehouseId
    ? [params.excludeSaleId, params.asOf, params.warehouseId]
    : [params.excludeSaleId, params.asOf];
  const convRes = await client.query(
    `SELECT s.id, s.units, s.unit_rate, s.aed_amount,
            COALESCE(s.status_updated_at, s.created_at) AS completed_at
     FROM ic_sales s
     WHERE s.settlement_mode = 'metal'
       AND s.metal_payment_method IN ('INR', 'CASH')
       AND s.order_status = 'completed'
       AND s.units > 0
       AND s.id <> $1::uuid
       AND COALESCE(s.status_updated_at, s.created_at) <= $2::timestamptz
       ${warehouseFilter}`,
    queryParams,
  );
  for (const row of convRes.rows) {
    const units = Number(row.units) || 0;
    if (units <= 0) continue;
    const cost = purchaseAedTotal(units, Number(row.unit_rate) || 0, row.aed_amount);
    if (cost <= 0) continue;
    events.push({
      kind: 'purchase',
      at: new Date(String(row.completed_at)).getTime(),
      sortKey: `metal-inr:${row.id}`,
      units,
      cost,
    });
  }
}

function remainingStockPoolBeforeSale(
  events: WarehouseInventoryEvent[],
): RemainingStockPool {
  const pool: RemainingStockPool = { units: 0, cost: 0 };
  const sorted = [...events].sort(compareInventoryEvents);

  for (const event of sorted) {
    if (event.kind === 'purchase') {
      addPurchaseToPool(pool, event.units, event.cost);
      continue;
    }
    const margin = computeSaleMargin(
      {
        units: event.units,
        collectedUnits: event.collectedUnits,
        orderStatus: 'completed',
        unitRate: event.unitRate,
        aedAmount: event.aedAmount,
        serviceCharge: event.serviceCharge,
      },
      { totalUnits: pool.units, totalCost: pool.cost },
    );
    consumeSaleFromPool(pool, margin.deliveredUnits);
  }

  return pool;
}

async function postSaleMarginVouchers(
  client: DbClient,
  sale: Record<string, unknown>,
  branchId: string,
): Promise<void> {
  if (String(sale.settlement_mode || '') === 'metal') {
    return;
  }
  const warehouseId = sale.warehouse_id ? String(sale.warehouse_id) : null;
  const asOf = sale.status_updated_at || sale.created_at;
  const priorEvents = warehouseId
    ? await loadWarehouseInventoryEvents(client, warehouseId, String(sale.id), asOf)
    : await loadGlobalInventoryEvents(client, String(sale.id), asOf);
  const poolBeforeSale = remainingStockPoolBeforeSale(priorEvents);
  const margin = resolveSaleMarginFromPool(
    {
      units: Number(sale.units) || 0,
      collectedUnits: sale.collected_units != null ? Number(sale.collected_units) : null,
      orderStatus: 'completed',
      unitRate: Number(sale.unit_rate) || 0,
      aedAmount: Number(sale.aed_amount) || 0,
      serviceCharge: Number(sale.service_charge) || 0,
    },
    poolBeforeSale,
  );

  const cogsAccountId = await ensureSystemAccount(
    client,
    branchId,
    'Cost of IC Sold',
    'd_expense',
    'ic_purchase_cost',
  );
  const inventoryAccountId = await ensureSystemAccount(
    client,
    branchId,
    'IC Stock',
    'personal',
    'ic_inventory',
  );
  const incomeAccountId = await ensureSystemAccount(
    client,
    branchId,
    'IC Sales',
    'income',
    'ic_transfer_sales',
  );
  const profitAccountId = await ensureSystemAccount(
    client,
    branchId,
    'IC Profit',
    'profit',
    'ic_sales_profit',
  );

  const voucherDate = isoDate(sale.status_updated_at || sale.created_at);
  const saleRef = String(sale.id);
  const avgLabel = margin.avgPurchaseRate.toFixed(4);

  await voidVoucherByReference(client, branchId, 'ic_sale_cogs', saleRef);

  if (margin.cogs > 0) {
    await postVoucherInTx(client, {
      branchId,
      voucherType: 'journal',
      voucherDate,
      debitAccountId: cogsAccountId,
      creditAccountId: inventoryAccountId,
      amount: margin.cogs,
      notes: `Cost of IC sold ${saleRef.slice(0, 8)} · ${margin.deliveredUnits} u @ ${avgLabel}`,
      referenceType: 'ic_sale_cogs',
      referenceId: saleRef,
      voucherStatus: 'active',
    });
  }

  const profitNotesSuffix = `${margin.deliveredUnits} u @ ${margin.saleRate.toFixed(4)} (avg cost ${avgLabel})`;

  if (margin.grossProfit > 0) {
    await postVoucherInTx(client, {
      branchId,
      voucherType: 'journal',
      voucherDate,
      debitAccountId: incomeAccountId,
      creditAccountId: profitAccountId,
      amount: margin.grossProfit,
      notes: `IC Sale profit ${saleRef.slice(0, 8)} · ${profitNotesSuffix}`,
      referenceType: 'ic_sale_profit',
      referenceId: saleRef,
      voucherStatus: 'active',
    });
  } else if (margin.grossProfit < 0) {
    await postVoucherInTx(client, {
      branchId,
      voucherType: 'journal',
      voucherDate,
      debitAccountId: profitAccountId,
      creditAccountId: cogsAccountId,
      amount: Math.abs(margin.grossProfit),
      notes: `IC Sale loss ${saleRef.slice(0, 8)} · ${profitNotesSuffix}`,
      referenceType: 'ic_sale_profit',
      referenceId: saleRef,
      voucherStatus: 'active',
    });
  } else {
    await voidVoucherByReference(client, branchId, 'ic_sale_profit', saleRef);
  }
}

function isMetalSettlement(mode: unknown): boolean {
  return String(mode || '') === 'metal';
}

async function ensureInventoryAccount(
  client: DbClient,
  branchId: string,
  metal: boolean,
): Promise<string> {
  if (metal) {
    return ensureSystemAccount(client, branchId, 'Metal Stock', 'personal', 'metal_inventory');
  }
  return ensureSystemAccount(client, branchId, 'IC Stock', 'personal', 'ic_inventory');
}

export async function voidVoucherByReference(
  client: DbClient,
  branchId: string,
  referenceType: string,
  referenceId: string,
): Promise<void> {
  await client.query(
    `UPDATE ic_fund_vouchers
     SET status = 'void',
         voided_at = CURRENT_TIMESTAMP,
         voided_by_name = $4
     WHERE branch_id = $1 AND reference_type = $2 AND reference_id = $3 AND status IN ('active', 'pending')`,
    [branchId, referenceType, referenceId, SYNC_ACTOR],
  );
}

export async function postVoucherInTx(
  client: DbClient,
  params: {
    branchId: string;
    voucherType: 'payment' | 'receipt' | 'journal' | 'contra';
    voucherDate: string;
    debitAccountId: string;
    creditAccountId: string;
    amount: number;
    notes: string;
    referenceType: string;
    referenceId: string;
    voucherStatus?: 'active' | 'pending';
  },
): Promise<string | null> {
  const amount = roundLedgerAmount(Number(params.amount));
  if (amount <= 0) return null;
  const voucherStatus = params.voucherStatus ?? 'active';

  const existing = await client.query(
    `SELECT id, amount, debit_account_id, credit_account_id, status
     FROM ic_fund_vouchers
     WHERE branch_id = $1 AND reference_type = $2 AND reference_id = $3 AND status IN ('active', 'pending')
     ORDER BY CASE WHEN status = 'active' THEN 1 ELSE 0 END DESC
     LIMIT 1`,
    [params.branchId, params.referenceType, params.referenceId],
  );
  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    const sameAccounts =
      roundLedgerAmount(Number(row.amount)) === amount &&
      String(row.debit_account_id) === params.debitAccountId &&
      String(row.credit_account_id) === params.creditAccountId;
    if (sameAccounts && String(row.status) === voucherStatus) {
      return String(row.id);
    }
    if (sameAccounts && String(row.status) === 'pending' && voucherStatus === 'active') {
      await client.query(`UPDATE ic_fund_vouchers SET status = 'active' WHERE id = $1`, [row.id]);
      return String(row.id);
    }
    await voidVoucherByReference(client, params.branchId, params.referenceType, params.referenceId);
  }

  const accounts = await lockFundAccounts(
    client,
    [params.debitAccountId, params.creditAccountId],
    params.branchId,
  );
  if (accounts.length !== 2) {
    throw new Error('IC Funds accounts not found for voucher posting');
  }
  const debit = accounts.find(r => String(r.id) === params.debitAccountId);
  const credit = accounts.find(r => String(r.id) === params.creditAccountId);
  if (!debit || !credit) throw new Error('IC Funds accounts not found for voucher posting');
  if (debit.status !== 'active' || credit.status !== 'active') {
    throw new Error('Inactive IC Funds accounts cannot be used');
  }

  const ruleError = validateVoucherAccounts({
    voucherType: params.voucherType,
    debitType: debit.account_type,
    creditType: credit.account_type,
    debitId: params.debitAccountId,
    creditId: params.creditAccountId,
  });
  if (ruleError) throw new Error(ruleError);

  const currencyError = validateVoucherCurrencyPolicy(debit, credit);
  if (currencyError) throw new Error(currencyError);

  await client.query(
    `INSERT INTO ic_fund_voucher_counters (branch_id, last_no) VALUES ($1, 0) ON CONFLICT (branch_id) DO NOTHING`,
    [params.branchId],
  );
  const counter = await client.query(
    `UPDATE ic_fund_voucher_counters SET last_no = last_no + 1 WHERE branch_id = $1 RETURNING last_no`,
    [params.branchId],
  );
  const voucherNo = Number(counter.rows[0]?.last_no) || 1;
  const id = `ICFV-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;

  await client.query(
    `INSERT INTO ic_fund_vouchers (
       id, branch_id, voucher_no, voucher_type, voucher_date,
       debit_account_id, credit_account_id, amount, notes,
       created_by_name, reference_type, reference_id, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      id,
      params.branchId,
      voucherNo,
      params.voucherType,
      params.voucherDate,
      params.debitAccountId,
      params.creditAccountId,
      amount,
      params.notes,
      SYNC_ACTOR,
      params.referenceType,
      params.referenceId,
      voucherStatus,
    ],
  );
  return id;
}

/** IC Transfer journals post to source branch when set, otherwise HQ ledger. */
function resolveIcFundsLedgerBranchId(explicitBranchId?: string | null): string {
  if (explicitBranchId) return String(explicitBranchId);
  return HQ_IC_FUNDS_BRANCH_ID;
}

async function resolvePurchaseBranchId(client: DbClient, purchaseId: string): Promise<string> {
  const res = await client.query(
    `SELECT COALESCE(w.branch_id, cp.branch_id) AS branch_id
     FROM ic_purchases p
     LEFT JOIN ic_warehouses w ON w.id = p.warehouse_id
     LEFT JOIN ic_counterparties cp ON cp.id = p.counterparty_id
     WHERE p.id = $1`,
    [purchaseId],
  );
  const branchId = res.rows[0]?.branch_id;
  return resolveIcFundsLedgerBranchId(branchId ? String(branchId) : null);
}

async function resolveSaleBranchId(client: DbClient, sale: Record<string, unknown>): Promise<string> {
  const customerName = String(sale.customer_name || '');
  const branchMatch = await client.query(
    `SELECT id FROM branches WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1`,
    [customerName],
  );
  if (branchMatch.rows.length > 0) return String(branchMatch.rows[0].id);

  if (sale.warehouse_id) {
    const warehouseRes = await client.query(
      `SELECT branch_id FROM ic_warehouses WHERE id = $1 LIMIT 1`,
      [sale.warehouse_id],
    );
    if (warehouseRes.rows[0]?.branch_id) {
      return String(warehouseRes.rows[0].branch_id);
    }
  }

  if (sale.counterparty_id) {
    const customerRes = await client.query(
      `SELECT branch_id FROM ic_counterparties WHERE id = $1 LIMIT 1`,
      [sale.counterparty_id],
    );
    if (customerRes.rows[0]?.branch_id) {
      return String(customerRes.rows[0].branch_id);
    }
  }

  return HQ_IC_FUNDS_BRANCH_ID;
}

async function resolveDefaultBranchId(client: DbClient): Promise<string> {
  const res = await client.query(`SELECT id FROM branches ORDER BY id ASC LIMIT 1`);
  if (res.rows.length > 0) return String(res.rows[0].id);
  return HQ_IC_FUNDS_BRANCH_ID;
}

export async function syncICCounterpartyFundAccount(counterpartyId: string): Promise<void> {
  try {
    const res = await query(
      `SELECT id, name, phone, email, branch_id FROM ic_counterparties WHERE id = $1 LIMIT 1`,
      [counterpartyId],
    );
    if (res.rows.length === 0) return;
    const row = res.rows[0];
    const branchId = row.branch_id ? String(row.branch_id) : await resolveDefaultBranchId(db);
    if (!branchId) return;
    await ensureLinkedAccount(db, {
      branchId,
      sourceType: 'ic_counterparty',
      sourceId: counterpartyId,
      name: String(row.name),
      phone: row.phone ? String(row.phone) : null,
    });
  } catch (err) {
    logger.error({ err, counterpartyId }, 'Failed to sync IC counterparty fund account');
  }
}

export async function syncICSupplierFundAccount(counterpartyId: string): Promise<void> {
  return syncICCounterpartyFundAccount(counterpartyId);
}

export async function syncICWarehouseFundAccount(warehouseId: string): Promise<void> {
  try {
    const res = await query(
      `SELECT id, name, phone, branch_id FROM ic_warehouses WHERE id = $1 LIMIT 1`,
      [warehouseId],
    );
    if (res.rows.length === 0) return;
    const row = res.rows[0];
    const branchId = row.branch_id ? String(row.branch_id) : await resolveDefaultBranchId(db);
    if (!branchId) return;
    await ensureLinkedAccount(db, {
      branchId,
      sourceType: 'ic_warehouse',
      sourceId: warehouseId,
      name: String(row.name),
      phone: row.phone ? String(row.phone) : null,
    });
  } catch (err) {
    logger.error({ err, warehouseId }, 'Failed to sync IC warehouse fund account');
  }
}

export async function syncICPurchaseToICFunds(purchaseId: string): Promise<void> {
  try {
    await ensureHqIcFundsBranch();
    await withTransaction(async (client) => {
      const purchaseRes = await client.query(`SELECT * FROM ic_purchases WHERE id = $1 LIMIT 1`, [purchaseId]);
      if (purchaseRes.rows.length === 0) return;
      const purchase = purchaseRes.rows[0];
      const branchId = await resolvePurchaseBranchId(client, purchaseId);
      const metal = isMetalSettlement(purchase.settlement_mode);

      if (metal) {
        const { syncMetalPurchaseLedgers } = await import('@/lib/metal/posting');
        await syncMetalPurchaseLedgers(client, purchase, branchId);
        return;
      }

      const units = Number(purchase.units) || 0;
      const amount = roundLedgerAmount(
        purchaseAedTotal(units, Number(purchase.unit_rate) || 0, purchase.aed_total),
      );
      if (amount <= 0) {
        await voidVoucherByReference(client, branchId, 'ic_purchase', purchaseId);
        return;
      }

      let supplierAccountId: string | null = null;
      const counterpartyId = purchase.counterparty_id ? String(purchase.counterparty_id) : null;

      if (counterpartyId) {
        const cpRes = await client.query(
          `SELECT id, name, phone FROM ic_counterparties WHERE id = $1 LIMIT 1`,
          [counterpartyId],
        );
        if (cpRes.rows.length > 0) {
          const cp = cpRes.rows[0];
          supplierAccountId = await ensureLinkedAccount(client, {
            branchId,
            sourceType: 'ic_counterparty',
            sourceId: String(cp.id),
            name: String(cp.name),
            phone: cp.phone ? String(cp.phone) : null,
          });
        }
      }

      if (!supplierAccountId) {
        supplierAccountId = await ensureLinkedAccount(client, {
          branchId,
          sourceType: 'ic_counterparty',
          sourceId: `purchase:${purchaseId}`,
          name: 'IC Purchase',
        });
      }

      const inventoryAccountId = await ensureInventoryAccount(client, branchId, false);

      if (!supplierAccountId || !inventoryAccountId) {
        throw new Error('Could not resolve IC Funds accounts for purchase');
      }

      await postVoucherInTx(client, {
        branchId,
        voucherType: 'journal',
        voucherDate: isoDate(purchase.created_at),
        debitAccountId: inventoryAccountId,
        creditAccountId: supplierAccountId,
        amount,
        notes: `IC purchase ${purchaseId.slice(0, 8)}`,
        referenceType: 'ic_purchase',
        referenceId: purchaseId,
      });
    });
  } catch (err) {
    logger.error({ err, purchaseId }, 'Failed to sync IC purchase to IC Funds');
    throw err;
  }
}

export async function removeICPurchaseFromICFunds(purchaseId: string): Promise<void> {
  try {
    const branchId = await resolvePurchaseBranchId(db, purchaseId);
    const purchaseRes = await db.query(
      `SELECT settlement_mode FROM ic_purchases WHERE id = $1 LIMIT 1`,
      [purchaseId],
    );
    if (isMetalSettlement(purchaseRes.rows[0]?.settlement_mode)) {
      const { voidMetalPurchaseLedgers } = await import('@/lib/metal/posting');
      await voidMetalPurchaseLedgers(db, branchId, purchaseId);
    } else {
      await voidVoucherByReference(db, branchId, 'ic_purchase', purchaseId);
    }
  } catch (err) {
    logger.error({ err, purchaseId }, 'Failed to remove IC purchase from IC Funds');
  }
}

export async function syncICSaleToICFunds(saleId: string): Promise<void> {
  try {
    await ensureHqIcFundsBranch();
    await withTransaction(async (client) => {
      const saleRes = await client.query(`SELECT * FROM ic_sales WHERE id = $1 LIMIT 1`, [saleId]);
      if (saleRes.rows.length === 0) return;
      const sale = saleRes.rows[0];
      const branchId = await resolveSaleBranchId(client, sale);
      const orderStatus = String(sale.order_status || '');
      const metal = isMetalSettlement(sale.settlement_mode);

      if (SALE_VOID_STATUSES.has(orderStatus)) {
        if (metal) {
          const { voidMetalSaleLedgers } = await import('@/lib/metal/posting');
          await voidMetalSaleLedgers(client, branchId, saleId);
        } else {
          await voidVoucherByReference(client, branchId, 'ic_sale', saleId);
          await voidSaleMarginVouchers(client, branchId, saleId);
        }
        return;
      }

      if (metal) {
        const { syncMetalSaleLedgers } = await import('@/lib/metal/posting');
        await syncMetalSaleLedgers(client, sale, branchId);
        await voidMetalCashIcStockVoucher(client, saleId, branchId);
        return;
      }

      const amount = (Number(sale.aed_amount) || 0) + (Number(sale.service_charge) || 0);
      if (amount <= 0 || (!SALE_GHOST_STATUSES.has(orderStatus) && orderStatus !== 'completed')) {
        await voidVoucherByReference(client, branchId, 'ic_sale', saleId);
        await voidSaleMarginVouchers(client, branchId, saleId);
        return;
      }

      const customerName =
        String(sale.order_customer_name || sale.customer_name || 'IC Customer').trim();

      const counterpartyId = sale.counterparty_id ? String(sale.counterparty_id) : null;

      const customerAccountId = counterpartyId
        ? await ensureLinkedAccount(client, {
            branchId,
            sourceType: 'ic_counterparty',
            sourceId: counterpartyId,
            name: customerName,
          })
        : await ensureLinkedAccount(client, {
            branchId,
            sourceType: 'ic_counterparty',
            sourceId: `name:${customerName.toLowerCase()}`,
            name: customerName,
          });

      const incomeAccountId = await ensureSystemAccount(
        client,
        branchId,
        'IC Sales',
        'income',
        'ic_transfer_sales',
      );

      if (!customerAccountId || !incomeAccountId) {
        throw new Error('Could not resolve IC Funds accounts for sale');
      }

      const voucherStatus = orderStatus === 'completed' ? 'active' : 'pending';
      const notesPrefix =
        voucherStatus === 'active' ? 'Sold IC' : 'IC sale pending';

      await postVoucherInTx(client, {
        branchId,
        voucherType: 'journal',
        voucherDate: isoDate(sale.status_updated_at || sale.created_at),
        debitAccountId: customerAccountId,
        creditAccountId: incomeAccountId,
        amount,
        notes: `${notesPrefix} ${saleId.slice(0, 8)}`,
        referenceType: 'ic_sale',
        voucherStatus,
        referenceId: saleId,
      });

      if (orderStatus === 'completed') {
        await postSaleMarginVouchers(client, sale, branchId);
      } else {
        await voidSaleMarginVouchers(client, branchId, saleId);
      }
    });
  } catch (err) {
    logger.error({ err, saleId }, 'Failed to sync IC sale to IC Funds');
    throw err;
  }
}

export async function removeICSaleFromICFunds(saleId: string): Promise<void> {
  try {
    const saleRes = await query(`SELECT * FROM ic_sales WHERE id = $1 LIMIT 1`, [saleId]);
    if (saleRes.rows.length === 0) return;
    const branchId = await resolveSaleBranchId(db, saleRes.rows[0]);
    if (isMetalSettlement(saleRes.rows[0].settlement_mode)) {
      const { voidMetalSaleLedgers } = await import('@/lib/metal/posting');
      await voidMetalSaleLedgers(db, branchId, saleId);
    } else {
      await voidVoucherByReference(db, branchId, 'ic_sale', saleId);
      await voidSaleMarginVouchers(db, branchId, saleId);
    }
  } catch (err) {
    logger.error({ err, saleId }, 'Failed to remove IC sale from IC Funds');
  }
}

/** Agent remittance batch leg: bank → contra; AED personal → payment (Dr personal, Cr agent). */
export async function postFxSettlementBatchPaymentInTx(
  client: DbClient,
  params: {
    batchId: string;
    collectionAccountId: string;
    toAccountId: string;
    amount: number;
    voucherDate: string;
    agentName: string;
    notes?: string | null;
  },
): Promise<string | null> {
  const amount = roundLedgerAmount(Number(params.amount));
  if (amount <= 0) return null;

  const toRes = await client.query(
    `SELECT account_type
     FROM ic_fund_accounts
     WHERE id = $1 AND branch_id = $2
     LIMIT 1`,
    [params.toAccountId, HQ_IC_FUNDS_BRANCH_ID],
  );
  if (toRes.rows.length === 0) {
    throw new Error('Receive-into account not found');
  }
  const toType = String(toRes.rows[0].account_type);

  const notes =
    params.notes?.trim() ||
    `FX remittance from ${params.agentName} · batch ${params.batchId.slice(0, 8)}`;
  const voucherType = toType === 'personal' ? 'payment' : 'contra';

  return postVoucherInTx(client, {
    branchId: HQ_IC_FUNDS_BRANCH_ID,
    voucherType,
    voucherDate: params.voucherDate,
    debitAccountId: params.toAccountId,
    creditAccountId: params.collectionAccountId,
    amount,
    notes,
    referenceType: 'ic_sale_fx_batch_payment',
    referenceId: params.batchId,
  });
}

export async function syncSaleFxSettlementLedgerInTx(
  _client: DbClient,
  _settlementId: string,
): Promise<{ receiptAmount: number; profitAmount: number }> {
  return { receiptAmount: 0, profitAmount: 0 };
}

export async function syncSaleFxSettlementLedger(_settlementId: string): Promise<void> {
  return;
}
