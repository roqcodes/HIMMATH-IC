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
  if (prev === next) return;

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

export async function ensureInrCounterpartyAccount(
  client: DbClient,
  branchId: string,
  counterpartyId: string,
  name: string,
): Promise<string | null> {
  return ensureInrLinkedAccount(client, branchId, 'ic_counterparty', counterpartyId, name);
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
  await client.query(
    `UPDATE inr_fund_vouchers
     SET status = 'void', voided_at = CURRENT_TIMESTAMP
     WHERE branch_id = $1 AND reference_type = $2 AND reference_id = $3 AND status = 'active'`,
    [branchId, referenceType, referenceId],
  );
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
  },
): Promise<string | null> {
  const amount = roundLedgerAmount(Number(params.amount));
  if (amount <= 0) return null;
  const voucherType = params.voucherType ?? 'journal';

  if (voucherType === 'journal' && params.referenceType && params.referenceId) {
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

  const counter = await client.query(
    `INSERT INTO inr_fund_voucher_counters (branch_id, last_no)
     VALUES ($1, 1)
     ON CONFLICT (branch_id) DO UPDATE SET last_no = inr_fund_voucher_counters.last_no + 1
     RETURNING last_no`,
    [params.branchId],
  );
  const voucherNo = Number(counter.rows[0]?.last_no) || 1;
  const id = `INFV-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;

  try {
    await client.query(
      `INSERT INTO inr_fund_vouchers (
         id, branch_id, voucher_no, voucher_type, voucher_date,
         debit_account_id, credit_account_id, amount, notes,
         created_by_name, reference_type, reference_id, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active')`,
      [
        id,
        params.branchId,
        voucherNo,
        voucherType,
        params.voucherDate,
        params.debitAccountId,
        params.creditAccountId,
        amount,
        params.notes,
        params.createdByName ?? SYNC_ACTOR,
        params.referenceType ?? null,
        params.referenceId ?? null,
      ],
    );
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
  },
): Promise<string | null> {
  return postInrVoucherInTx(client, {
    ...params,
    voucherType: 'journal',
  });
}

export function resolveInrLedgerBranchId(_explicitBranchId?: string | null): string {
  return HQ_IC_FUNDS_BRANCH_ID;
}
