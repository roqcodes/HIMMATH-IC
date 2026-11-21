import 'server-only';

import type { QueryResult } from 'pg';
import { roundLedgerAmount } from '@/lib/icFunds/currencyPolicy';
import { HQ_IC_FUNDS_BRANCH_ID } from '@/lib/icFunds/hqBranch';
import { sortedIds } from '@/lib/db';
import { logger } from '@/lib/logger';

type DbClient = {
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
};

const SYNC_ACTOR = 'INR ledger sync';
const INR_PER_IC_UNIT = 100_000;

/** Keep the warehouse's display/cache balance derived from its INR ledger. */
export async function syncWarehouseCurrentStockFromInrAccounts(
  client: DbClient,
  accountIds: string[],
): Promise<void> {
  const ids = sortedIds(accountIds);
  if (!ids.length) return;
  await client.query(
    `UPDATE ic_warehouses w
     SET current_stock = ROUND((a.opening_balance + COALESCE(v.net, 0)) / $2::numeric, 8)
     FROM inr_fund_accounts a
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(
         CASE WHEN x.debit_account_id = a.id THEN x.amount ELSE 0 END
         - CASE WHEN x.credit_account_id = a.id THEN x.amount ELSE 0 END
       ), 0) AS net
       FROM inr_fund_vouchers x
       WHERE x.status = 'active' AND (x.debit_account_id = a.id OR x.credit_account_id = a.id)
     ) v ON TRUE
     WHERE a.id = ANY($1::varchar[]) AND a.source_type = 'ic_warehouse'
       AND a.source_id = w.id::text`,
    [ids, INR_PER_IC_UNIT],
  );
}

async function lockInrAccounts(client: DbClient, accountIds: string[], branchId: string) {
  const ids = sortedIds(accountIds);
  if (ids.length === 0) return [];
  const accounts = await client.query(
    `SELECT id, account_type, status FROM inr_fund_accounts
     WHERE id = ANY($1::varchar[]) AND branch_id = $2
     ORDER BY id
     FOR UPDATE`,
    [ids, branchId],
  );
  return accounts.rows;
}

async function insertInrIgnoringUnique(
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

export async function ensureInrSystemAccount(
  client: DbClient,
  branchId: string,
  name: string,
  accountType: 'bank' | 'personal' | 'income' | 'profit' | 'expense' | 'inventory' | 'd_expense' | 'capital',
  sourceId: string,
): Promise<string> {
  const existing = await client.query(
    `SELECT id, name, account_type FROM inr_fund_accounts
     WHERE branch_id = $1 AND source_id = $2
     LIMIT 1`,
    [branchId, sourceId],
  );
  if (existing.rows.length > 0) {
    const id = String(existing.rows[0].id);
    if (String(existing.rows[0].name) !== name || String(existing.rows[0].account_type) !== accountType) {
      await client.query(
        `UPDATE inr_fund_accounts SET name = $1, account_type = $2 WHERE id = $3`,
        [name, accountType, id],
      );
    }
    return id;
  }

  const id = `INFA-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
  const inserted = await insertInrIgnoringUnique(
    client,
    'inr_sys_acct',
    `INSERT INTO inr_fund_accounts (
       id, branch_id, name, account_type, opening_balance, notes, source_type, source_id
     ) VALUES ($1,$2,$3,$4,0,'','system',$5)`,
    [id, branchId, name, accountType, sourceId],
  );
  if (inserted) return id;

  const again = await client.query(
    `SELECT id FROM inr_fund_accounts
     WHERE branch_id = $1 AND source_id = $2
     LIMIT 1`,
    [branchId, sourceId],
  );
  if (again.rows.length > 0) return String(again.rows[0].id);
  logger.error({ branchId, sourceId, name }, 'INR system account insert raced and could not be found');
  throw new Error('Could not create INR system account');
}

export async function applyInrAccountOpening(
  client: DbClient,
  accountId: string,
  openingBalance: number,
): Promise<void> {
  const next = roundLedgerAmount(Number(openingBalance) || 0);
  const current = await client.query(
    `SELECT opening_balance FROM inr_fund_accounts WHERE id = $1 LIMIT 1`,
    [accountId],
  );
  if (current.rows.length === 0) return;
  const prev = roundLedgerAmount(Number(current.rows[0].opening_balance) || 0);
  if (prev !== next) {
    const used = await client.query(
      `SELECT 1 FROM inr_fund_vouchers
       WHERE debit_account_id = $1 OR credit_account_id = $1
       LIMIT 1`,
      [accountId],
    );
    if (used.rows.length > 0) {
      throw new Error('Opening balance is locked after entries exist. Post a journal adjustment instead.');
    }
    await client.query(`UPDATE inr_fund_accounts SET opening_balance = $2 WHERE id = $1`, [accountId, next]);
  }

  const branchRes = await client.query(
    `SELECT branch_id FROM inr_fund_accounts WHERE id = $1 LIMIT 1`,
    [accountId],
  );
  const branchId = branchRes.rows[0]?.branch_id ? String(branchRes.rows[0].branch_id) : null;
  if (!branchId) return;

  const equityId = `INFA-OBE-${branchId}`;
  const netRes = await client.query(
    `SELECT COALESCE(SUM(opening_balance), 0)::text AS net_opening
     FROM inr_fund_accounts
     WHERE branch_id = $1 AND id <> $2`,
    [branchId, equityId],
  );
  const equityOpening = roundLedgerAmount(-(Number(netRes.rows[0]?.net_opening) || 0));
  await client.query(
    `INSERT INTO inr_fund_accounts (
       id, branch_id, name, account_type, opening_balance, notes, source_type, source_id
     ) VALUES ($1, $2, 'Opening Balance Equity', 'profit', $3,
       'System offset for account opening balances', 'system', 'opening_balance_equity')
     ON CONFLICT (id) DO UPDATE SET opening_balance = EXCLUDED.opening_balance`,
    [equityId, branchId, equityOpening],
  );
  await syncWarehouseCurrentStockFromInrAccounts(client, [accountId]);
}

export async function ensureInrLinkedAccount(
  client: DbClient,
  branchId: string,
  sourceType: 'ic_counterparty' | 'ic_warehouse',
  sourceIdRaw: string,
  name: string,
): Promise<string | null> {
  if (!name.trim()) return null;
  const sourceId = sourceIdRaw.slice(0, 50);
  const existing = await client.query(
    `SELECT id FROM inr_fund_accounts
     WHERE branch_id = $1 AND source_type = $2 AND source_id = $3
     LIMIT 1`,
    [branchId, sourceType, sourceId],
  );
  if (existing.rows.length > 0) return String(existing.rows[0].id);

  const id = `INFA-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
  const inserted = await insertInrIgnoringUnique(
    client,
    'inr_src_acct',
    `INSERT INTO inr_fund_accounts (
       id, branch_id, name, account_type, opening_balance, notes, source_type, source_id
     ) VALUES ($1,$2,$3,'personal',0,'',$4,$5)`,
    [id, branchId, name.trim(), sourceType, sourceId],
  );
  if (inserted) return id;

  const again = await client.query(
    `SELECT id FROM inr_fund_accounts
     WHERE branch_id = $1 AND source_type = $2 AND source_id = $3
     LIMIT 1`,
    [branchId, sourceType, sourceId],
  );
  return again.rows.length > 0 ? String(again.rows[0].id) : null;
}

export async function ensureInrWarehouseAccount(
  client: DbClient,
  warehouseId: string,
  branchId = HQ_IC_FUNDS_BRANCH_ID,
): Promise<string | null> {
  const warehouse = await client.query(
    `SELECT name, opening_inr FROM ic_warehouses WHERE id=$1 LIMIT 1`, [warehouseId],
  );
  const row = warehouse.rows[0];
  if (!row) return null;
  const accountId = await ensureInrLinkedAccount(
    client, branchId, 'ic_warehouse', warehouseId, `Warehouse: ${String(row.name)}`,
  );
  if (accountId) await applyInrAccountOpening(client, accountId, Number(row.opening_inr) || 0);
  return accountId;
}

export async function ensureInrCounterpartyAccount(
  client: DbClient,
  branchId: string,
  counterpartyId: string,
  name: string,
): Promise<string | null> {
  return ensureInrLinkedAccount(client, branchId, 'ic_counterparty', counterpartyId, name);
}

/** Compact role suffix so `{uuid}#xxxx` stays within varchar(50). */
const METAL_INR_ROLE_CODE: Record<string, string> = {
  customer: 'cu',
  supplier: 'su',
  aed_settlement: 'as',
  metal_stock: 'st',
  metal_sales: 'sl',
  metal_cost: 'cs',
  metal_profit: 'pr',
  warehouse_inr: 'wi',
};

function metalInrRoleCode(role: string): string {
  const code = METAL_INR_ROLE_CODE[role];
  if (!code) throw new Error(`Unknown metal INR journal role: ${role}`);
  return code;
}

/** One active INR journal per (type, ref) — split metal uses `{dealId}#{debit}{credit}` (41 chars). */
export function metalInrJournalReferenceId(
  dealId: string,
  line: { debit: string; credit: string },
): string {
  return `${dealId}#${metalInrRoleCode(line.debit)}${metalInrRoleCode(line.credit)}`;
}

export async function voidInrMetalDealVouchers(
  client: DbClient,
  branchId: string,
  dealId: string,
  referenceTypes: readonly string[],
): Promise<void> {
  const { voidCapitalAllocationsForVoucher } = await import('@/lib/capital/allocation');
  const existing = await client.query(
    `SELECT id FROM inr_fund_vouchers
     WHERE branch_id = $1 AND status = 'active'
       AND (
         (reference_type = ANY($2::text[]) AND reference_id = $3)
         OR reference_id LIKE $4
       )`,
    [branchId, referenceTypes, dealId, `${dealId}#%`],
  );
  for (const row of existing.rows) {
    await voidCapitalAllocationsForVoucher(client, String(row.id), 'INR');
  }
  const accounts = await client.query(
    `SELECT DISTINCT account_id FROM (
       SELECT debit_account_id AS account_id FROM inr_fund_vouchers WHERE branch_id=$1 AND status='active' AND ((reference_type=ANY($2::text[]) AND reference_id=$3) OR reference_id LIKE $4)
       UNION SELECT credit_account_id FROM inr_fund_vouchers WHERE branch_id=$1 AND status='active' AND ((reference_type=ANY($2::text[]) AND reference_id=$3) OR reference_id LIKE $4)
     ) q`, [branchId, referenceTypes, dealId, `${dealId}#%`],
  );
  await client.query(
    `UPDATE inr_fund_vouchers
     SET status = 'void', voided_at = CURRENT_TIMESTAMP
     WHERE branch_id = $1 AND status = 'active'
       AND (
         (reference_type = ANY($2::text[]) AND reference_id = $3)
         OR reference_id LIKE $4
       )`,
    [branchId, referenceTypes, dealId, `${dealId}#%`],
  );
  await syncWarehouseCurrentStockFromInrAccounts(client, accounts.rows.map((r) => String(r.account_id)));
}

export async function voidInrVoucherByReference(
  client: DbClient,
  branchId: string,
  referenceType: string,
  referenceId: string,
): Promise<void> {
  const { voidCapitalAllocationsForVoucher } = await import('@/lib/capital/allocation');
  const existing = await client.query(
    `SELECT id FROM inr_fund_vouchers
     WHERE branch_id = $1 AND reference_type = $2 AND reference_id = $3 AND status = 'active'`,
    [branchId, referenceType, referenceId],
  );
  for (const row of existing.rows) {
    await voidCapitalAllocationsForVoucher(client, String(row.id), 'INR');
  }
  const accounts = await client.query(
    `SELECT DISTINCT account_id FROM (
       SELECT debit_account_id AS account_id FROM inr_fund_vouchers WHERE branch_id=$1 AND reference_type=$2 AND reference_id=$3 AND status='active'
       UNION SELECT credit_account_id FROM inr_fund_vouchers WHERE branch_id=$1 AND reference_type=$2 AND reference_id=$3 AND status='active'
     ) q`, [branchId, referenceType, referenceId],
  );
  await client.query(
    `UPDATE inr_fund_vouchers
     SET status = 'void', voided_at = CURRENT_TIMESTAMP
     WHERE branch_id = $1 AND reference_type = $2 AND reference_id = $3 AND status = 'active'`,
    [branchId, referenceType, referenceId],
  );
  await syncWarehouseCurrentStockFromInrAccounts(client, accounts.rows.map((r) => String(r.account_id)));
}

export async function ensureInrCashTill(client: DbClient, branchId: string): Promise<string> {
  return ensureInrSystemAccount(client, branchId, 'Cash INR', 'bank', 'inr_cash');
}

export async function postInrVoucherInTx(
  client: DbClient,
  params: {
    branchId: string;
    voucherType?: 'payment' | 'receipt' | 'journal' | 'contra';
    voucherDate: string;
    debitAccountId: string;
    creditAccountId: string;
    amount: number;
    notes: string;
    referenceType?: string | null;
    referenceId?: string | null;
    createdByName?: string | null;
    managerId?: string | null;
    aedAgentId?: string | null;
    /** When false, allow multiple active journals with the same reference (metal split legs). Default true. */
    dedupeReference?: boolean;
  },
): Promise<string | null> {
  const amount = roundLedgerAmount(Number(params.amount));
  if (amount <= 0) return null;
  const voucherType = params.voucherType ?? 'journal';
  const dedupeReference = params.dedupeReference !== false;

  if (dedupeReference && voucherType === 'journal' && params.referenceType && params.referenceId) {
    const existing = await client.query(
      `SELECT id FROM inr_fund_vouchers
       WHERE branch_id = $1 AND reference_type = $2 AND reference_id = $3 AND status = 'active'
       LIMIT 1`,
      [params.branchId, params.referenceType, params.referenceId],
    );
    if (existing.rows.length > 0) {
      await voidInrVoucherByReference(client, params.branchId, params.referenceType, params.referenceId);
    }
  }

  const accounts = await lockInrAccounts(
    client,
    [params.debitAccountId, params.creditAccountId],
    params.branchId,
  );
  if (accounts.length !== 2) throw new Error('INR ledger accounts not found');

  const id = `INFV-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;

  // Single CTE: atomically increment the INR voucher counter and insert the voucher row
  // in one round-trip instead of two separate queries.
  try {
    await client.query(
      `WITH ctr AS (
         INSERT INTO inr_fund_voucher_counters (branch_id, last_no)
         VALUES ($1, 1)
         ON CONFLICT (branch_id) DO UPDATE SET last_no = inr_fund_voucher_counters.last_no + 1
         RETURNING last_no
       )
       INSERT INTO inr_fund_vouchers (
         id, branch_id, voucher_no, voucher_type, voucher_date,
         debit_account_id, credit_account_id, amount, notes,
         created_by_name, reference_type, reference_id, status, manager_id, aed_agent_id
       )
       SELECT $2, $1, ctr.last_no, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', $12, $13
       FROM ctr`,
      [
        params.branchId,                    // $1
        id,                                 // $2
        voucherType,                        // $3
        params.voucherDate,                 // $4
        params.debitAccountId,              // $5
        params.creditAccountId,             // $6
        amount,                             // $7
        params.notes,                       // $8
        params.createdByName ?? SYNC_ACTOR, // $9
        params.referenceType ?? null,       // $10
        params.referenceId ?? null,         // $11
        params.managerId ?? null,           // $12
        params.aedAgentId?.trim() || null,  // $13
      ],
    );
    await syncWarehouseCurrentStockFromInrAccounts(client, [params.debitAccountId, params.creditAccountId]);
    return id;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== '23505' || !params.referenceType || !params.referenceId) throw err;
    const again = await client.query(
      `SELECT id FROM inr_fund_vouchers
       WHERE branch_id = $1 AND reference_type = $2 AND reference_id = $3 AND status = 'active'
       LIMIT 1`,
      [params.branchId, params.referenceType, params.referenceId],
    );
    if (again.rows.length > 0) return String(again.rows[0].id);
    throw err;
  }
}

export async function postInrJournalInTx(
  client: DbClient,
  params: {
    branchId: string;
    voucherDate: string;
    debitAccountId: string;
    creditAccountId: string;
    amount: number;
    notes: string;
    referenceType: string;
    referenceId: string;
    dedupeReference?: boolean;
  },
): Promise<string | null> {
  return postInrVoucherInTx(client, {
    ...params,
    voucherType: 'journal',
    dedupeReference: params.dedupeReference,
  });
}

export function resolveInrLedgerBranchId(_explicitBranchId?: string | null): string {
  return HQ_IC_FUNDS_BRANCH_ID;
}
