'use server';

import { query, runQueryBatch, withTransaction } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { writeAuditLog } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import {
  createCustomerCognitoUser,
  resetCustomerCognitoPasswordAction,
  updateCognitoUserName,
} from '@/app/actions/cognitoActions';
import { requireICFundsAccess } from '@/lib/icFunds/requireAccess';
import { ensureHqIcFundsBranch } from '@/lib/icFunds/ensureHqBranch';
import { backfillICTransferFundAccounts } from '@/lib/icFunds/icTransferFundSync';
import { HQ_IC_FUNDS_BRANCH_ID, HQ_IC_FUNDS_BRANCH_SLUG, isHqIcFundsBranch, isHqIcFundsBranchId } from '@/lib/icFunds/hqBranch';
import {
  accountBalanceSql,
  accountMovementJoinSql,
  accountPendingBalanceSql,
  accountPendingMovementJoinSql,
  trialBalanceSplit,
  VOUCHER_LEDGER_STATUS_SQL,
} from '@/lib/icFunds/accountBalance';
import {
  purchaseAedTotal,
  remainingStockWac,
  simulateWarehouseInventory,
  type ICWarehousePLReport,
  type WarehouseInventoryEvent,
} from '@/lib/icFunds/warehouseProfit';
import { validateVoucherAccounts } from '@/lib/icFunds/voucherRules';
import { validateVoucherCurrencyPolicy, roundLedgerAmount } from '@/lib/icFunds/currencyPolicy';
import {
  buildVoucherListFilter,
  clampVoucherListLimit,
  clampVoucherListOffset,
  VOUCHER_DETAIL_SELECT_SQL,
  VOUCHER_FROM_SQL,
  VOUCHER_LIST_SELECT_COLUMNS,
  VOUCHER_LIST_SELECT_SQL,
  VOUCHER_REPORT_MAX,
} from '@/lib/icFunds/voucherQueries';
import { ActionError } from '@/lib/errors/actionError';
import {
  buildAccountDetailStats,
  type ICFundAccountDetail,
  type ICFundAccountRelatedPurchase,
  type ICFundAccountRelatedSale,
} from '@/lib/icFunds/accountDetailAnalytics';
import {
  createICFundAccountSchema,
  icFundsDateRangeSchema,
  postICFundVoucherSchema,
  updateICFundAccountSchema,
} from '@/lib/validations/icFunds';
import { PASSWORD_INVALID_MESSAGE, validatePassword } from '@/lib/passwordValidation';
import type {
  ICFundAccount,
  ICFundAccountType,
  ICFundStatementLine,
  ICFundTrialBalanceLine,
  ICFundVoucher,
  ICFundVoucherType,
} from '@/types';

type ActionOk<T> = { success: true; data: T };
type ActionErr = { success: false; error: string };
type ActionResult<T> = ActionOk<T> | ActionErr;

export async function ensureHqIcFundsBranchAction(): Promise<ActionResult<{ id: string; slug: string }>> {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return { success: false, error: 'Admin access required.' };
  }
  try {
    await ensureHqIcFundsBranch();
    // Idempotent: post missing payable/receivable journals for IC Transfer deals.
    void backfillICTransferFundAccounts();
    return { success: true, data: { id: HQ_IC_FUNDS_BRANCH_ID, slug: HQ_IC_FUNDS_BRANCH_SLUG } };
  } catch (err) {
    logger.error({ err }, 'ensureHqIcFundsBranchAction failed');
    return { success: false, error: 'Failed to prepare HQ IC Funds ledger.' };
  }
}

function isoDate(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const raw = String(value ?? '');
  return raw.length >= 10 ? raw.slice(0, 10) : raw;
}

function mapAccount(row: Record<string, unknown>): ICFundAccount {
  const branchId = String(row.branch_id);
  const branchSlug = row.branch_slug ? String(row.branch_slug) : undefined;
  return {
    id: String(row.id),
    branchId,
    branchName: row.branch_name ? String(row.branch_name) : undefined,
    branchSlug,
    name: String(row.name),
    accountType: row.account_type as ICFundAccountType,
    status: row.status === 'inactive' ? 'inactive' : 'active',
    openingBalance: Number(row.opening_balance) || 0,
    notes: String(row.notes ?? ''),
    createdAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
    balance: Number(row.balance) || 0,
    pendingBalance: Number(row.pending_balance) || 0,
    customerId: row.customer_id ? String(row.customer_id) : undefined,
    email: row.portal_email
      ? String(row.portal_email)
      : row.customer_email
        ? String(row.customer_email)
        : undefined,
    phone: row.customer_phone ? String(row.customer_phone) : undefined,
    hasPortalLogin: Boolean(row.customer_auth_user_id),
    sourceType: row.source_type ? String(row.source_type) : undefined,
    sourceId: row.source_id ? String(row.source_id) : undefined,
  };
}

function mapVoucher(row: Record<string, unknown>): ICFundVoucher {
  return {
    id: String(row.id),
    branchId: String(row.branch_id),
    voucherNo: Number(row.voucher_no) || 0,
    voucherType: row.voucher_type as ICFundVoucherType,
    voucherDate: isoDate(row.voucher_date),
    debitAccountId: String(row.debit_account_id),
    creditAccountId: String(row.credit_account_id),
    debitAccountName: String(row.debit_account_name ?? ''),
    creditAccountName: String(row.credit_account_name ?? ''),
    debitAccountType: row.debit_account_type as ICFundAccountType,
    creditAccountType: row.credit_account_type as ICFundAccountType,
    amount: Number(row.amount) || 0,
    notes: String(row.notes ?? ''),
    createdBy: row.created_by ? String(row.created_by) : undefined,
    createdByName: row.created_by_name ? String(row.created_by_name) : undefined,
    createdByUserId: row.created_by_user_id ? String(row.created_by_user_id) : undefined,
    createdAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
    status:
      row.status === 'void'
        ? 'void'
        : row.status === 'pending'
          ? 'pending'
          : 'active',
    voidedAt: row.voided_at ? String(row.voided_at) : undefined,
    voidedByName: row.voided_by_name ? String(row.voided_by_name) : undefined,
    referenceType: row.reference_type ? String(row.reference_type) : undefined,
    referenceId: row.reference_id ? String(row.reference_id) : undefined,
  };
}

function accountBalanceSelectSql(opts?: {
  asOfParam?: string | null;
  branchParam?: string | null;
  accountParam?: string | null;
}): string {
  const joinOpts = {
    asOfParam: opts?.asOfParam ?? undefined,
    branchParam: opts?.branchParam ?? undefined,
    accountParam: opts?.accountParam ?? undefined,
  };
  const movementJoin = accountMovementJoinSql(joinOpts);
  const pendingJoin = accountPendingMovementJoinSql(joinOpts);
  return `SELECT a.*, ${accountBalanceSql(opts?.asOfParam ?? null)} AS balance,
    ${accountPendingBalanceSql()} AS pending_balance,
    COALESCE(c.email, p.email) AS portal_email,
    c.email AS customer_email,
    COALESCE(c.phone, a.phone) AS customer_phone,
    c.auth_user_id AS customer_auth_user_id,
    b.name AS branch_name,
    b.slug AS branch_slug
    FROM ic_fund_accounts a
    ${movementJoin}
    ${pendingJoin}
    LEFT JOIN customers c ON c.id = a.customer_id
    LEFT JOIN branches b ON b.id = a.branch_id`;
}

async function fetchAccountsWithBalances(
  branchId: string,
  asOfDate?: string | null,
): Promise<ICFundAccount[]> {
  const joinOpts = asOfDate
    ? { asOfParam: '$2', branchParam: '$1' }
    : { branchParam: '$1' };
  const sql = asOfDate
    ? `${accountBalanceSelectSql(joinOpts)} WHERE a.branch_id = $1 ORDER BY a.account_type, LOWER(a.name)`
    : `${accountBalanceSelectSql(joinOpts)} WHERE a.branch_id = $1 ORDER BY a.account_type, LOWER(a.name)`;
  const params = asOfDate ? [branchId, asOfDate] : [branchId];
  const res = await query(sql, params);
  return res.rows.map(r => mapAccount(r as Record<string, unknown>));
}

type ProfitLossTotals = {
  income: number;
  profit: number;
  expense: number;
  dExpense: number;
};

async function queryProfitLossTotals(
  branchId: string,
  opts?: { startDate?: string; endDate?: string },
): Promise<ProfitLossTotals> {
  const clauses = [`v.branch_id = $1`, `COALESCE(v.status, 'active') = 'active'`];
  const params: unknown[] = [branchId];
  let idx = 2;
  if (opts?.startDate) {
    clauses.push(`v.voucher_date >= $${idx}::date`);
    params.push(opts.startDate);
    idx += 1;
  }
  if (opts?.endDate) {
    clauses.push(`v.voucher_date <= $${idx}::date`);
    params.push(opts.endDate);
    idx += 1;
  }

  const res = await query(
    `SELECT
      COALESCE(SUM(CASE
        WHEN ca.account_type = 'income' THEN v.amount
        WHEN da.account_type = 'income' THEN -v.amount
        ELSE 0
      END), 0) AS income,
      COALESCE(SUM(CASE
        WHEN ca.account_type = 'profit' THEN v.amount
        WHEN da.account_type = 'profit' THEN -v.amount
        ELSE 0
      END), 0) AS profit,
      COALESCE(SUM(CASE
        WHEN da.account_type = 'expense' THEN v.amount
        WHEN ca.account_type = 'expense' THEN -v.amount
        ELSE 0
      END), 0) AS expense,
      COALESCE(SUM(CASE
        WHEN da.account_type = 'd_expense' THEN v.amount
        WHEN ca.account_type = 'd_expense' THEN -v.amount
        ELSE 0
      END), 0) AS d_expense
    FROM ic_fund_vouchers v
    JOIN ic_fund_accounts da ON da.id = v.debit_account_id
    JOIN ic_fund_accounts ca ON ca.id = v.credit_account_id
    WHERE ${clauses.join(' AND ')}`,
    params,
  );

  const row = res.rows[0] as Record<string, unknown> | undefined;
  return {
    income: Number(row?.income) || 0,
    profit: Number(row?.profit) || 0,
    expense: Number(row?.expense) || 0,
    dExpense: Number(row?.d_expense) || 0,
  };
}

/** Paginated voucher list + total count in a single query (one round trip). */
export async function getICFundVoucherPageAction(params: {
  branchId: string;
  voucherType?: ICFundVoucherType;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
  includeStats?: boolean;
}): Promise<
  ActionResult<{
    vouchers: ICFundVoucher[];
    total: number;
    stats?: ICFundVoucherRangeStats;
  }>
> {
  const access = await requireICFundsAccess(params.branchId, 'read');
  if (!access.ok) return { success: false, error: access.error };

  const limit = clampVoucherListLimit(params.limit);
  const offset = clampVoucherListOffset(params.offset);
  const includeStats = Boolean(params.includeStats);

  try {
    const { clauses, values, nextIdx } = buildVoucherListFilter(params);
    const listSql = {
      text: `SELECT ${VOUCHER_LIST_SELECT_COLUMNS},
         COUNT(*) OVER()::int AS _total_count
       ${VOUCHER_FROM_SQL}
       WHERE ${clauses.join(' AND ')}
       ORDER BY v.voucher_date DESC, v.voucher_no DESC, v.created_at DESC
       LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      values: [...values, limit, offset],
    };

    const statsFromSql = params.search?.trim() ? VOUCHER_FROM_SQL : 'FROM ic_fund_vouchers v';
    const statsSql = includeStats
      ? {
          text: `SELECT
             COUNT(*) FILTER (WHERE v.status <> 'void')::int AS entries,
             COUNT(*) FILTER (WHERE v.status = 'void')::int AS voided,
             COALESCE(SUM(v.amount) FILTER (WHERE v.status = 'active'), 0) AS total,
             COUNT(*) FILTER (WHERE v.status = 'active')::int AS posted_count,
             COUNT(*) FILTER (WHERE v.status = 'pending')::int AS pending_count,
             COALESCE(SUM(v.amount) FILTER (WHERE v.status = 'pending'), 0) AS pending_total,
             COALESCE(MAX(v.amount) FILTER (WHERE v.status = 'active'), 0) AS largest
           ${statsFromSql}
           WHERE ${clauses.join(' AND ')}`,
          values,
        }
      : null;

    const results = await runQueryBatch(
      [
        () => query(listSql.text, listSql.values),
        ...(statsSql ? [() => query(statsSql.text, statsSql.values)] : []),
      ],
      includeStats ? 2 : 1,
    );
    const listRes = results[0];
    const statsRes = includeStats ? results[1] : null;

    const rows = listRes.rows;
    const total = rows.length > 0 ? Number((rows[0] as Record<string, unknown>)._total_count) || 0 : 0;
    const vouchers = rows.map(row => {
      const { _total_count: _ignored, ...rest } = row as Record<string, unknown>;
      return mapVoucher(rest);
    });

    let stats: ICFundVoucherRangeStats | undefined;
    if (includeStats && statsRes) {
      const row = statsRes.rows[0] as Record<string, unknown> | undefined;
      const entries = Number(row?.entries) || 0;
      const voided = Number(row?.voided) || 0;
      const totalAmount = Number(row?.total) || 0;
      const postedCount = Number(row?.posted_count) || 0;
      stats = {
        entries,
        voided,
        total: totalAmount,
        posted: postedCount,
        pending: Number(row?.pending_count) || 0,
        pendingTotal: Number(row?.pending_total) || 0,
        largest: Number(row?.largest) || 0,
      };
    }

    return { success: true, data: { vouchers, total, stats } };
  } catch (err) {
    logger.error({ err, params, limit, offset }, 'Failed to load IC fund voucher page');
    return { success: false, error: 'Failed to load vouchers.' };
  }
}

export async function countICFundVouchersAction(params: {
  branchId: string;
  voucherType?: ICFundVoucherType;
  startDate?: string;
  endDate?: string;
  search?: string;
}): Promise<ActionResult<number>> {
  const access = await requireICFundsAccess(params.branchId, 'read');
  if (!access.ok) return { success: false, error: access.error };

  try {
    const { clauses, values } = buildVoucherListFilter(params);
    const needsJoin = Boolean(params.search?.trim());
    const fromSql = needsJoin ? VOUCHER_FROM_SQL : 'FROM ic_fund_vouchers v';
    const res = await query(
      `SELECT COUNT(*)::int AS n ${fromSql} WHERE ${clauses.join(' AND ')}`,
      values,
    );
    return { success: true, data: Number(res.rows[0]?.n) || 0 };
  } catch (err) {
    logger.error({ err, params }, 'Failed to count IC fund vouchers');
    return { success: false, error: 'Failed to count vouchers.' };
  }
}

export type ICFundVoucherRangeStats = {
  entries: number;
  voided: number;
  total: number;
  posted: number;
  pending: number;
  pendingTotal: number;
  largest: number;
};

export async function getICFundVoucherRangeStatsAction(params: {
  branchId: string;
  voucherType?: ICFundVoucherType;
  startDate?: string;
  endDate?: string;
}): Promise<ActionResult<ICFundVoucherRangeStats>> {
  const access = await requireICFundsAccess(params.branchId, 'read');
  if (!access.ok) return { success: false, error: access.error };

  try {
    const { clauses, values } = buildVoucherListFilter(params);
    const res = await query(
      `SELECT
         COUNT(*) FILTER (WHERE v.status <> 'void')::int AS entries,
         COUNT(*) FILTER (WHERE v.status = 'void')::int AS voided,
         COALESCE(SUM(v.amount) FILTER (WHERE v.status = 'active'), 0) AS total,
         COUNT(*) FILTER (WHERE v.status = 'active')::int AS posted_count,
         COUNT(*) FILTER (WHERE v.status = 'pending')::int AS pending_count,
         COALESCE(SUM(v.amount) FILTER (WHERE v.status = 'pending'), 0) AS pending_total,
         COALESCE(MAX(v.amount) FILTER (WHERE v.status = 'active'), 0) AS largest
       FROM ic_fund_vouchers v
       WHERE ${clauses.join(' AND ')}`,
      values,
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    const entries = Number(row?.entries) || 0;
    const voided = Number(row?.voided) || 0;
    const total = Number(row?.total) || 0;
    const postedCount = Number(row?.posted_count) || 0;
    return {
      success: true,
      data: {
        entries,
        voided,
        total,
        posted: postedCount,
        pending: Number(row?.pending_count) || 0,
        pendingTotal: Number(row?.pending_total) || 0,
        largest: Number(row?.largest) || 0,
      },
    };
  } catch (err) {
    logger.error({ err, params }, 'Failed to load IC fund voucher range stats');
    return { success: false, error: 'Failed to load voucher summary.' };
  }
}

export async function listICFundAccountsAction(branchId: string): Promise<ICFundAccount[]> {
  const access = await requireICFundsAccess(branchId, 'read');
  if (!access.ok) return [];
  try {
    return await fetchAccountsWithBalances(branchId);
  } catch (err) {
    logger.error({ err, branchId }, 'Failed to list IC fund accounts');
    return [];
  }
}

/** Fast account list for voucher pickers — skips voucher balance aggregation. */
export async function listICFundAccountsLiteAction(branchId: string): Promise<ICFundAccount[]> {
  const access = await requireICFundsAccess(branchId, 'read');
  if (!access.ok) return [];
  try {
    const res = await query(
      `SELECT a.id, a.branch_id, a.name, a.account_type, a.status, a.opening_balance,
              a.notes, a.created_at, a.customer_id, a.source_type, a.source_id, a.phone,
              c.email AS customer_email,
              COALESCE(c.phone, a.phone) AS customer_phone,
              c.auth_user_id AS customer_auth_user_id,
              b.name AS branch_name, b.slug AS branch_slug,
              a.opening_balance AS balance,
              0::numeric AS pending_balance
       FROM ic_fund_accounts a
       LEFT JOIN customers c ON c.id = a.customer_id
       LEFT JOIN branches b ON b.id = a.branch_id
       WHERE a.branch_id = $1
       ORDER BY a.account_type, LOWER(a.name)`,
      [branchId],
    );
    return res.rows.map(r => mapAccount(r as Record<string, unknown>));
  } catch (err) {
    logger.error({ err, branchId }, 'Failed to list lite IC fund accounts');
    return [];
  }
}

export async function listHQICFundAccountsAction(): Promise<ICFundAccount[]> {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') return [];
  try {
    await ensureHqIcFundsBranch();
    const res = await query(
      `${accountBalanceSelectSql({ branchParam: '$1' })} WHERE a.branch_id = $1 ORDER BY a.account_type, LOWER(a.name)`,
      [HQ_IC_FUNDS_BRANCH_ID],
    );
    return res.rows.map(r => mapAccount(r as Record<string, unknown>));
  } catch (err) {
    logger.error({ err }, 'Failed to list HQ IC fund accounts');
    return [];
  }
}

export async function getICFundAccountByCustomerIdAction(
  branchId: string,
  customerId: string,
): Promise<ICFundAccount | null> {
  const access = await requireICFundsAccess(branchId, 'read');
  if (!access.ok) return null;
  try {
    const res = await query(
      `${accountBalanceSelectSql({ branchParam: '$1' })} WHERE a.branch_id = $1 AND (
        a.customer_id = $2 OR (a.source_type = 'ic_customer' AND a.source_id = $2)
      ) LIMIT 1`,
      [branchId, customerId],
    );
    if (res.rows.length === 0) return null;
    return mapAccount(res.rows[0] as Record<string, unknown>);
  } catch (err) {
    logger.error({ err, branchId, customerId }, 'Failed to load IC fund account by customer');
    return null;
  }
}

export async function createICFundAccountAction(
  input: unknown,
): Promise<ActionResult<ICFundAccount>> {
  const parsed = createICFundAccountSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const access = await requireICFundsAccess(parsed.data.branchId, 'write');
  if (!access.ok) return { success: false, error: access.error };

  await ensureHqIcFundsBranch();
  const ledgerBranchId =
    access.user.role === 'admin' || isHqIcFundsBranchId(parsed.data.branchId)
      ? HQ_IC_FUNDS_BRANCH_ID
      : parsed.data.branchId;

  const id = `ICFA-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
  const email = parsed.data.email?.trim() || '';
  const password = parsed.data.password?.trim() || '';
  const phone = parsed.data.phone?.trim() || null;

  if (parsed.data.requireSignIn && !email) {
    return { success: false, error: 'Email is required for portal login.' };
  }

  if (parsed.data.requireSignIn && !validatePassword(password).isValid) {
    return { success: false, error: PASSWORD_INVALID_MESSAGE };
  }

  let customerId: string | null = null;
  let portalUserId: string | null = null;

  try {
    if (parsed.data.requireSignIn) {
      customerId = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const cognitoRes = await createCustomerCognitoUser({
        email,
        name: parsed.data.name.trim(),
        branchId: ledgerBranchId,
        password,
      });
      if (!cognitoRes.success || !cognitoRes.userId) {
        return { success: false, error: cognitoRes.error || 'Failed to create portal login account.' };
      }

      await query(
        `INSERT INTO customers (id, branch_id, name, phone, email, balance, status, auth_user_id)
         VALUES ($1, $2, $3, $4, $5, 0, 'active', $6)`,
        [
          customerId,
          ledgerBranchId,
          parsed.data.name.trim(),
          phone,
          email,
          cognitoRes.userId,
        ],
      );
      await query(`UPDATE profiles SET customer_id = $1 WHERE id = $2`, [customerId, cognitoRes.userId]);
    }

    if (!portalUserId) {
      await query(
        `INSERT INTO ic_fund_accounts (id, branch_id, name, account_type, opening_balance, notes, customer_id, phone, source_type, source_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          id,
          ledgerBranchId,
          parsed.data.name.trim(),
          parsed.data.accountType,
          Number(parsed.data.openingBalance.toFixed(2)),
          parsed.data.notes?.trim() ?? '',
          customerId,
          phone,
          customerId ? 'ic_customer' : null,
          customerId,
        ],
      );
    }
    const res = await query(`${accountBalanceSelectSql({ accountParam: '$1' })} WHERE a.id = $1`, [id]);
    revalidatePath(`/${access.slug}/ic-funds/accounts`);
    revalidatePath(`/${access.slug}/customers`);
    return { success: true, data: mapAccount(res.rows[0] as Record<string, unknown>) };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === '23505') return { success: false, error: 'An account with this name already exists' };
    logger.error({ err }, 'Failed to create IC fund account');
    return { success: false, error: 'Failed to create account' };
  }
}

export async function seedICFundStarterAccountsAction(branchId: string): Promise<ActionResult<{ created: number }>> {
  const access = await requireICFundsAccess(branchId, 'write');
  if (!access.ok) return { success: false, error: access.error };

  const starters: Array<{ name: string; accountType: ICFundAccountType }> = [
    { name: 'Collection', accountType: 'bank' },
    { name: 'Fund', accountType: 'bank' },
    { name: 'Cashier', accountType: 'bank' },
  ];

  let created = 0;
  try {
    for (const starter of starters) {
      const exists = await query(
        `SELECT 1 FROM ic_fund_accounts WHERE branch_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) LIMIT 1`,
        [branchId, starter.name],
      );
      if (exists.rows.length > 0) continue;
      const id = `ICFA-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
      await query(
        `INSERT INTO ic_fund_accounts (id, branch_id, name, account_type, opening_balance, notes)
         VALUES ($1, $2, $3, $4, 0, '')
         ON CONFLICT DO NOTHING`,
        [id, branchId, starter.name, starter.accountType],
      );
      created += 1;
    }
    return { success: true, data: { created } };
  } catch (err) {
    logger.error({ err, branchId }, 'Failed to seed IC fund starter accounts');
    return { success: false, error: 'Failed to seed starter accounts' };
  }
}

export async function updateICFundAccountAction(input: unknown): Promise<ActionResult<ICFundAccount>> {
  const parsed = updateICFundAccountSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const access = await requireICFundsAccess(parsed.data.branchId, 'write');
  if (!access.ok) return { success: false, error: access.error };

  try {
    const existing = await query(
      `SELECT * FROM ic_fund_accounts WHERE id = $1 AND branch_id = $2 LIMIT 1`,
      [parsed.data.id, parsed.data.branchId],
    );
    if (existing.rows.length === 0) return { success: false, error: 'Account not found' };

    if (parsed.data.accountType && parsed.data.accountType !== existing.rows[0].account_type) {
      const used = await query(
        `SELECT 1 FROM ic_fund_vouchers
         WHERE debit_account_id = $1 OR credit_account_id = $1
         LIMIT 1`,
        [parsed.data.id],
      );
      if (used.rows.length > 0) {
        return { success: false, error: 'Cannot change type after vouchers have been posted' };
      }
    }

    if (parsed.data.openingBalance !== undefined) {
      const used = await query(
        `SELECT 1 FROM ic_fund_vouchers
         WHERE debit_account_id = $1 OR credit_account_id = $1
         LIMIT 1`,
        [parsed.data.id],
      );
      if (used.rows.length > 0) {
        return {
          success: false,
          error: 'Opening balance is locked after entries exist. Post a journal adjustment instead.',
        };
      }
    }

    const existingType = String(existing.rows[0].account_type);
    const nextType = parsed.data.accountType ?? existingType;

    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    const push = (col: string, val: unknown) => {
      sets.push(`${col} = $${idx}`);
      values.push(val);
      idx += 1;
    };

    if (parsed.data.name !== undefined) push('name', parsed.data.name.trim());
    if (parsed.data.accountType !== undefined) push('account_type', parsed.data.accountType);
    if (parsed.data.status !== undefined) push('status', parsed.data.status);
    if (parsed.data.openingBalance !== undefined) push('opening_balance', Number(parsed.data.openingBalance.toFixed(2)));
    if (parsed.data.notes !== undefined) push('notes', parsed.data.notes.trim());

    if (parsed.data.phone !== undefined) {
      push('phone', parsed.data.phone.trim() || null);
      const customerId = existing.rows[0].customer_id ? String(existing.rows[0].customer_id) : null;
      if (customerId) {
        await query(`UPDATE customers SET phone = $1 WHERE id = $2`, [
          parsed.data.phone.trim() || null,
          customerId,
        ]);
      }
    }

    const enablingPortal = Boolean(parsed.data.requireSignIn);
    if (sets.length === 0 && parsed.data.phone === undefined && !enablingPortal) {
      return { success: false, error: 'No fields to update' };
    }

    if (sets.length > 0) {
      values.push(parsed.data.id, parsed.data.branchId);
      await query(
        `UPDATE ic_fund_accounts SET ${sets.join(', ')} WHERE id = $${idx} AND branch_id = $${idx + 1}`,
        values,
      );
    }

    if (enablingPortal) {
      const portalCheck = await query(
        `SELECT c.auth_user_id AS customer_auth_user_id
         FROM ic_fund_accounts a
         LEFT JOIN customers c ON c.id = a.customer_id
         WHERE a.id = $1 AND a.branch_id = $2
         LIMIT 1`,
        [parsed.data.id, parsed.data.branchId],
      );
      const portalRow = portalCheck.rows[0] as Record<string, unknown> | undefined;
      const hasPortal = Boolean(portalRow?.customer_auth_user_id);
      if (!hasPortal) {
        const email = parsed.data.email?.trim() || '';
        const password = parsed.data.password?.trim() || '';
        const accountName =
          parsed.data.name?.trim() || String(existing.rows[0].name ?? '').trim();
        const phone =
          parsed.data.phone !== undefined
            ? parsed.data.phone.trim() || null
            : existing.rows[0].phone
              ? String(existing.rows[0].phone)
              : null;

        {
          const newCustomerId = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const cognitoRes = await createCustomerCognitoUser({
            email,
            name: accountName,
            branchId: parsed.data.branchId,
            password,
          });
          if (!cognitoRes.success || !cognitoRes.userId) {
            return { success: false, error: cognitoRes.error || 'Failed to create portal login account.' };
          }

          await query(
            `INSERT INTO customers (id, branch_id, name, phone, email, balance, status, auth_user_id)
             VALUES ($1, $2, $3, $4, $5, 0, 'active', $6)`,
            [newCustomerId, parsed.data.branchId, accountName, phone, email, cognitoRes.userId],
          );
          await query(`UPDATE profiles SET customer_id = $1 WHERE id = $2`, [newCustomerId, cognitoRes.userId]);
          await query(
            `UPDATE ic_fund_accounts
             SET customer_id = $1,
                 source_type = COALESCE(source_type, 'ic_customer'),
                 source_id = COALESCE(source_id, $1)
             WHERE id = $2 AND branch_id = $3`,
            [newCustomerId, parsed.data.id, parsed.data.branchId],
          );
        }
        revalidatePath(`/${access.slug}/customers`);
      }
    }

    const accountName = parsed.data.name?.trim();
    const customerId = existing.rows[0].customer_id ? String(existing.rows[0].customer_id) : null;
    if (accountName && customerId) {
      const customerRes = await query(
        `SELECT email, auth_user_id FROM customers WHERE id = $1 LIMIT 1`,
        [customerId],
      );
      const customerEmail = customerRes.rows[0]?.email ? String(customerRes.rows[0].email) : '';
      const cognitoUserId = customerRes.rows[0]?.auth_user_id;
      await query(`UPDATE customers SET name = $1 WHERE id = $2`, [accountName, customerId]);
      if (cognitoUserId && customerEmail) {
        await updateCognitoUserName(customerEmail, accountName);
      }
    }

    const res = await query(`${accountBalanceSelectSql({ accountParam: '$1' })} WHERE a.id = $1`, [parsed.data.id]);
    revalidatePath(`/${access.slug}/ic-funds/accounts`);
    return { success: true, data: mapAccount(res.rows[0] as Record<string, unknown>) };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === '23505') return { success: false, error: 'An account with this name already exists' };
    logger.error({ err }, 'Failed to update IC fund account');
    return { success: false, error: 'Failed to update account' };
  }
}

export async function resetICFundAccountPasswordAction(
  branchId: string,
  accountId: string,
  passwordRaw: string,
): Promise<ActionResult<void>> {
  const access = await requireICFundsAccess(branchId, 'write');
  if (!access.ok) return { success: false, error: access.error };
  if (!validatePassword(passwordRaw).isValid) {
    return { success: false, error: PASSWORD_INVALID_MESSAGE };
  }

  try {
    const res = await query(
      `SELECT c.email AS customer_email, c.auth_user_id AS customer_auth_user_id
       FROM ic_fund_accounts a
       LEFT JOIN customers c ON c.id = a.customer_id
       WHERE a.id = $1 AND a.branch_id = $2
       LIMIT 1`,
      [accountId, branchId],
    );
    if (res.rows.length === 0) return { success: false, error: 'Account not found' };
    const row = res.rows[0] as Record<string, unknown>;
    const email = row.customer_email ? String(row.customer_email) : '';
    const customerAuthUserId = row.customer_auth_user_id ? String(row.customer_auth_user_id) : '';
    if (!email || !customerAuthUserId) {
      return { success: false, error: 'This account has no portal login.' };
    }

    const reset = await resetCustomerCognitoPasswordAction(email, passwordRaw, access.slug);
    if (!reset.success) return { success: false, error: reset.error || 'Failed to reset password' };
    return { success: true, data: undefined };
  } catch (err) {
    logger.error({ err, branchId, accountId }, 'Failed to reset IC fund account password');
    return { success: false, error: 'Failed to reset password' };
  }
}

export async function listICFundVouchersAction(params: {
  branchId: string;
  voucherType?: ICFundVoucherType;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<ICFundVoucher[]> {
  const access = await requireICFundsAccess(params.branchId, 'read');
  if (!access.ok) return [];

  const limit = clampVoucherListLimit(params.limit);
  const offset = clampVoucherListOffset(params.offset);

  try {
    const { clauses, values, nextIdx } = buildVoucherListFilter(params);
    const res = await query(
      `${VOUCHER_LIST_SELECT_SQL}
       WHERE ${clauses.join(' AND ')}
       ORDER BY v.voucher_date DESC, v.voucher_no DESC, v.created_at DESC
       LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      [...values, limit, offset],
    );
    return res.rows.map(r => mapVoucher(r as Record<string, unknown>));
  } catch (err) {
    logger.error({ err, params, limit, offset }, 'Failed to list IC fund vouchers');
    throw new ActionError('Failed to load vouchers. Please try again.', {
      scope: 'listICFundVouchersAction',
      branchId: params.branchId,
      voucherType: params.voucherType,
      limit,
      offset,
      cause: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function postICFundVoucherAction(input: unknown): Promise<ActionResult<ICFundVoucher>> {
  const parsed = postICFundVoucherSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const access = await requireICFundsAccess(parsed.data.branchId, 'write');
  if (!access.ok) return { success: false, error: access.error };

  const amount = roundLedgerAmount(Number(parsed.data.amount));
  if (amount <= 0) return { success: false, error: 'Amount must be greater than zero' };

  try {
    const id = await withTransaction(async (client) => {
      const accounts = await client.query(
        `SELECT id, account_type, status, branch_id
         FROM ic_fund_accounts
         WHERE id = ANY($1::varchar[]) AND branch_id = $2
         ORDER BY id
         FOR UPDATE`,
        [[parsed.data.debitAccountId, parsed.data.creditAccountId], parsed.data.branchId],
      );
      if (accounts.rows.length !== 2) {
        throw new Error('One or both accounts were not found');
      }

      const debit = accounts.rows.find(r => String(r.id) === parsed.data.debitAccountId);
      const credit = accounts.rows.find(r => String(r.id) === parsed.data.creditAccountId);
      if (!debit || !credit) {
        throw new Error('One or both accounts were not found');
      }
      if (debit.status !== 'active' || credit.status !== 'active') {
        throw new Error('Inactive accounts cannot be used');
      }

      const ruleError = validateVoucherAccounts({
        voucherType: parsed.data.voucherType,
        debitType: debit.account_type,
        creditType: credit.account_type,
        debitId: parsed.data.debitAccountId,
        creditId: parsed.data.creditAccountId,
      });
      if (ruleError) {
        throw new Error(ruleError);
      }

      const currencyError = validateVoucherCurrencyPolicy(debit, credit);
      if (currencyError) {
        throw new Error(currencyError);
      }

      await client.query(
        `INSERT INTO ic_fund_voucher_counters (branch_id, last_no)
         VALUES ($1, 0)
         ON CONFLICT (branch_id) DO NOTHING`,
        [parsed.data.branchId],
      );
      const counter = await client.query(
        `UPDATE ic_fund_voucher_counters
         SET last_no = last_no + 1
         WHERE branch_id = $1
         RETURNING last_no`,
        [parsed.data.branchId],
      );
      const voucherNo = Number(counter.rows[0]?.last_no) || 1;
      const voucherId = `ICFV-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;

      await client.query(
        `INSERT INTO ic_fund_vouchers (
           id, branch_id, voucher_no, voucher_type, voucher_date,
           debit_account_id, credit_account_id, amount, notes,
           created_by, created_by_name, created_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          voucherId,
          parsed.data.branchId,
          voucherNo,
          parsed.data.voucherType,
          parsed.data.voucherDate,
          parsed.data.debitAccountId,
          parsed.data.creditAccountId,
          amount,
          parsed.data.notes?.trim() ?? '',
          access.user.id ?? null,
          access.user.name ?? null,
          access.user.id ?? null,
        ],
      );
      return voucherId;
    });

    await writeAuditLog({
      actor: access.user,
      action: 'create',
      entityType: 'ic_fund_voucher',
      entityId: id,
      branchId: parsed.data.branchId,
      after: { voucherType: parsed.data.voucherType, amount },
    });

    const res = await query(`${VOUCHER_DETAIL_SELECT_SQL} WHERE v.id = $1`, [id]);
    return { success: true, data: mapVoucher(res.rows[0] as Record<string, unknown>) };
  } catch (err) {
    logger.error({ err }, 'Failed to post IC fund voucher');
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save voucher' };
  }
}

export async function deleteICFundVoucherAction(
  branchId: string,
  voucherId: string,
): Promise<ActionResult<{ id: string }>> {
  const access = await requireICFundsAccess(branchId, 'write');
  if (!access.ok) return { success: false, error: access.error };

  try {
    const res = await query(
      `UPDATE ic_fund_vouchers
       SET status = 'void',
           voided_at = CURRENT_TIMESTAMP,
           voided_by_name = $3
       WHERE id = $1 AND branch_id = $2 AND status = 'active'
       RETURNING id`,
      [voucherId, branchId, access.user.name ?? access.user.id ?? 'User'],
    );
    if (res.rows.length === 0) {
      const exists = await query(
        `SELECT status FROM ic_fund_vouchers WHERE id = $1 AND branch_id = $2`,
        [voucherId, branchId],
      );
      if (exists.rows.length === 0) return { success: false, error: 'Voucher not found' };
      return { success: false, error: 'Voucher is already void' };
    }
    await writeAuditLog({
      actor: access.user,
      action: 'void',
      entityType: 'ic_fund_voucher',
      entityId: voucherId,
      branchId,
    });
    return { success: true, data: { id: voucherId } };
  } catch (err) {
    logger.error({ err, voucherId }, 'Failed to void IC fund voucher');
    return { success: false, error: 'Failed to void voucher' };
  }
}

export async function getICFundStatementAction(params: {
  branchId: string;
  accountId: string;
  startDate?: string;
  endDate?: string;
}): Promise<ActionResult<{ account: ICFundAccount; opening: number; lines: ICFundStatementLine[]; closing: number }>> {
  const access = await requireICFundsAccess(params.branchId, 'read');
  if (!access.ok) return { success: false, error: access.error };

  try {
    const accRes = await query(
      `${accountBalanceSelectSql({ branchParam: '$2', accountParam: '$1' })} WHERE a.id = $1 AND a.branch_id = $2`,
      [params.accountId, params.branchId],
    );
    if (accRes.rows.length === 0) return { success: false, error: 'Account not found' };
    const account = mapAccount(accRes.rows[0] as Record<string, unknown>);

    const beforeParams: unknown[] = [params.accountId];
    let beforeSql = `
      SELECT
        COALESCE(SUM(CASE WHEN debit_account_id = $1 THEN amount ELSE 0 END), 0) AS dr,
        COALESCE(SUM(CASE WHEN credit_account_id = $1 THEN amount ELSE 0 END), 0) AS cr
      FROM ic_fund_vouchers
      WHERE (debit_account_id = $1 OR credit_account_id = $1)
        AND COALESCE(status, 'active') = 'active'
    `;
    if (params.startDate) {
      beforeSql += ` AND voucher_date < $2`;
      beforeParams.push(params.startDate);
    } else {
      beforeSql += ` AND FALSE`;
    }
    const before = await query(beforeSql, beforeParams);
    const opening =
      account.openingBalance +
      (Number(before.rows[0]?.dr) || 0) -
      (Number(before.rows[0]?.cr) || 0);

    const clauses = [
      '(v.debit_account_id = $1 OR v.credit_account_id = $1)',
      VOUCHER_LEDGER_STATUS_SQL,
    ];
    const values: unknown[] = [params.accountId];
    let idx = 2;
    if (params.startDate) {
      clauses.push(`v.voucher_date >= $${idx}`);
      values.push(params.startDate);
      idx += 1;
    }
    if (params.endDate) {
      clauses.push(`v.voucher_date <= $${idx}`);
      values.push(params.endDate);
      idx += 1;
    }

    const vRes = await query(
      `${VOUCHER_DETAIL_SELECT_SQL}
       WHERE ${clauses.join(' AND ')}
       ORDER BY v.voucher_date ASC, v.voucher_no ASC, v.created_at ASC`,
      values,
    );

    let running = opening;
    const lines: ICFundStatementLine[] = [
      {
        date: params.startDate ?? '',
        voucherNo: 0,
        voucherType: 'journal',
        particulars: 'OPENING BALANCE',
        debit: 0,
        credit: 0,
        balance: Number(opening.toFixed(2)),
        notes: '',
      },
    ];

    for (const row of vRes.rows) {
      const v = mapVoucher(row as Record<string, unknown>);
      const debit = v.debitAccountId === params.accountId ? v.amount : 0;
      const credit = v.creditAccountId === params.accountId ? v.amount : 0;
      if (v.status === 'active') {
        running += debit - credit;
      }
      const counterparty = debit > 0 ? v.creditAccountName : v.debitAccountName;
      const counterpartyAccountId = debit > 0 ? v.creditAccountId : v.debitAccountId;
      lines.push({
        date: v.voucherDate,
        voucherNo: v.voucherNo,
        voucherType: v.voucherType,
        particulars: counterparty,
        counterpartyAccountId,
        debit,
        credit,
        balance: Number(running.toFixed(2)),
        notes: v.notes,
        userName: v.createdByName,
        userAt: v.createdAt,
        status: v.status,
        referenceType: v.referenceType,
        referenceId: v.referenceId,
      });
    }

    return {
      success: true,
      data: {
        account,
        opening: Number(opening.toFixed(2)),
        lines,
        closing: Number(running.toFixed(2)),
      },
    };
  } catch (err) {
    logger.error({ err, params }, 'Failed to load IC fund statement');
    return { success: false, error: 'Failed to load statement' };
  }
}

export async function getCustomerICFundStatementAction(params: {
  branchId: string;
  accountId: string;
  customerId: string;
  startDate?: string;
  endDate?: string;
}): Promise<
  ActionResult<{
    account: ICFundAccount;
    opening: number;
    closing: number;
    lines: ICFundStatementLine[];
  }>
> {
  return getICFundStatementAction(params);
}

export async function getICFundAccountDetailAction(params: {
  branchId?: string;
  accountId: string;
}): Promise<ActionResult<ICFundAccountDetail>> {
  try {
    const accRes = await query(
      `${accountBalanceSelectSql({ accountParam: '$1' })} WHERE a.id = $1`,
      [params.accountId],
    );
    if (accRes.rows.length === 0) return { success: false, error: 'Account not found' };
    const account = mapAccount(accRes.rows[0] as Record<string, unknown>);
    const branchId = account.branchId;

    const access = await requireICFundsAccess(branchId, 'read');
    if (!access.ok) return { success: false, error: access.error };

    if (params.branchId && params.branchId !== branchId) {
      return { success: false, error: 'Account not found' };
    }

    const vRes = await query(
      `${VOUCHER_DETAIL_SELECT_SQL}
       WHERE (v.debit_account_id = $1 OR v.credit_account_id = $1)
         AND ${VOUCHER_LEDGER_STATUS_SQL}
       ORDER BY v.voucher_date ASC, v.voucher_no ASC, v.created_at ASC`,
      [params.accountId],
    );
    const vouchers = vRes.rows.map(r => mapVoucher(r as Record<string, unknown>));
    const stats = buildAccountDetailStats(vouchers, params.accountId);

    const statementResult = await getICFundStatementAction({
      branchId,
      accountId: params.accountId,
    });
    if (!statementResult.success) return { success: false, error: statementResult.error };

    const detail: ICFundAccountDetail = {
      account,
      statement: {
        opening: statementResult.data.opening,
        lines: statementResult.data.lines,
        closing: statementResult.data.closing,
      },
      vouchers: [...vouchers].reverse(),
      stats,
    };

    if (account.sourceType === 'ic_supplier' && account.sourceId) {
      const purchases = await query(
        `SELECT p.id, p.created_at, p.units, p.aed_total, p.payment_method, w.name AS warehouse_name
         FROM ic_purchases p
         LEFT JOIN ic_warehouses w ON w.id = p.warehouse_id
         WHERE p.supplier_id = $1
         ORDER BY p.created_at DESC
         LIMIT 100`,
        [account.sourceId],
      );
      detail.relatedPurchases = purchases.rows.map(row => ({
        id: String(row.id),
        date: row.created_at ? String(row.created_at) : '',
        units: Number(row.units) || 0,
        aedAmount: Number(row.aed_total) || 0,
        paymentMethod: row.payment_method ? String(row.payment_method) : undefined,
        warehouseName: row.warehouse_name ? String(row.warehouse_name) : undefined,
      })) as ICFundAccountRelatedPurchase[];

      const supplier = await query(`SELECT commission FROM ic_suppliers WHERE id = $1 LIMIT 1`, [
        account.sourceId,
      ]);
      if (supplier.rows[0]) {
        detail.relatedMeta = {
          commission: Number(supplier.rows[0].commission) || 0,
        };
      }
    }

    if (account.sourceType === 'ic_warehouse' && account.sourceId) {
      const sales = await query(
        `SELECT id, created_at, units, aed_amount, order_status, payment_status, order_customer_name
         FROM ic_sales
         WHERE warehouse_id = $1
         ORDER BY created_at DESC
         LIMIT 100`,
        [account.sourceId],
      );
      detail.relatedSales = sales.rows.map(row => ({
        id: String(row.id),
        date: row.created_at ? String(row.created_at) : '',
        units: Number(row.units) || 0,
        aedAmount: Number(row.aed_amount) || 0,
        orderStatus: row.order_status ? String(row.order_status) : undefined,
        paymentStatus: row.payment_status ? String(row.payment_status) : undefined,
        customerName: row.order_customer_name ? String(row.order_customer_name) : undefined,
      })) as ICFundAccountRelatedSale[];

      const warehouse = await query(`SELECT current_stock FROM ic_warehouses WHERE id = $1 LIMIT 1`, [
        account.sourceId,
      ]);
      if (warehouse.rows[0]) {
        detail.relatedMeta = {
          ...detail.relatedMeta,
          stock: Number(warehouse.rows[0].current_stock) || 0,
        };
      }
    }

    return { success: true, data: detail };
  } catch (err) {
    logger.error({ err, params }, 'Failed to load IC fund account detail');
    return { success: false, error: 'Failed to load account detail' };
  }
}

export async function getICFundReportBundleAction(params: unknown): Promise<
  ActionResult<{
    accounts: ICFundAccount[];
    cashBank: ICFundAccount[];
    allVouchers: ICFundVoucher[];
    dExpenses: ICFundVoucher[];
    receivables: ICFundAccount[];
    payables: ICFundAccount[];
    trialBalance: ICFundTrialBalanceLine[];
    asOfDate: string | null;
    profitLoss: {
      income: number;
      profit: number;
      expense: number;
      dExpense: number;
      net: number;
    };
    balanceSheet: {
      bank: number;
      receivables: number;
      payables: number;
      equity: number;
      accumulatedPL: number;
      totalAssets: number;
      totalLiabilitiesEquity: number;
      balanced: boolean;
    };
  }>
> {
  const parsed = icFundsDateRangeSchema.safeParse(params);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const access = await requireICFundsAccess(parsed.data.branchId, 'read');
  if (!access.ok) return { success: false, error: access.error };

  try {
    const asOfDate = parsed.data.endDate ?? null;
    const accounts = await fetchAccountsWithBalances(parsed.data.branchId, asOfDate);
    const periodVouchers = await listICFundVouchersAction({
      branchId: parsed.data.branchId,
      voucherType: undefined,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      limit: VOUCHER_REPORT_MAX,
      offset: 0,
    });
    const periodPL = await queryProfitLossTotals(parsed.data.branchId, {
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
    });
    const cumulativePL = asOfDate
      ? await queryProfitLossTotals(parsed.data.branchId, { endDate: asOfDate })
      : null;

    const { income, profit, expense, dExpense } = periodPL;
    const accumulatedTotals = cumulativePL ?? periodPL;
    const accumulatedPL =
      accumulatedTotals.income - accumulatedTotals.expense - accumulatedTotals.dExpense;

    const personal = accounts.filter(a => a.accountType === 'personal');
    const cashBank = accounts.filter(a => a.accountType === 'bank');
    const receivables = personal.filter(a => a.balance > 0 || (a.pendingBalance ?? 0) > 0);
    const payables = personal.filter(a => a.balance < 0 || (a.pendingBalance ?? 0) < 0);

    const bankTotal = cashBank.reduce((s, a) => s + a.balance, 0);
    const ar = receivables.reduce((s, a) => s + a.balance, 0);
    const ap = payables.reduce((s, a) => s + Math.abs(a.balance), 0);
    const profitReserve = accounts
      .filter(a => a.accountType === 'profit')
      .reduce((s, a) => s + -a.balance, 0);
    const equity = profitReserve + accumulatedPL;
    const totalAssets = bankTotal + ar;
    const totalLiabilitiesEquity = ap + equity;

    const trialBalance: ICFundTrialBalanceLine[] = accounts
      .filter(a => a.balance !== 0 || (a.pendingBalance ?? 0) !== 0)
      .map(a => {
        const split = trialBalanceSplit(a.balance);
        const pendingSplit = trialBalanceSplit(a.pendingBalance ?? 0);
        return {
          accountId: a.id,
          accountName: a.name,
          accountType: a.accountType,
          debit: Number(split.debit.toFixed(2)),
          credit: Number(split.credit.toFixed(2)),
          pendingDebit: Number(pendingSplit.debit.toFixed(2)),
          pendingCredit: Number(pendingSplit.credit.toFixed(2)),
        };
      })
      .sort((a, b) => a.accountType.localeCompare(b.accountType) || a.accountName.localeCompare(b.accountName));

    const trialDebit = trialBalance.reduce((s, l) => s + l.debit, 0);
    const trialCredit = trialBalance.reduce((s, l) => s + l.credit, 0);
    const balanced = Math.abs(trialDebit - trialCredit) < 0.01;

    return {
      success: true,
      data: {
        accounts,
        cashBank,
        allVouchers: periodVouchers,
        dExpenses: periodVouchers.filter(
          v => v.debitAccountType === 'd_expense' || v.creditAccountType === 'd_expense',
        ),
        receivables,
        payables,
        trialBalance,
        asOfDate,
        profitLoss: {
          income: Number(income.toFixed(2)),
          profit: Number(profit.toFixed(2)),
          expense: Number(expense.toFixed(2)),
          dExpense: Number(dExpense.toFixed(2)),
          net: Number((income + profit - expense - dExpense).toFixed(2)),
        },
        balanceSheet: {
          bank: Number(bankTotal.toFixed(2)),
          receivables: Number(ar.toFixed(2)),
          payables: Number(ap.toFixed(2)),
          equity: Number(profitReserve.toFixed(2)),
          accumulatedPL: Number(accumulatedPL.toFixed(2)),
          totalAssets: Number(totalAssets.toFixed(2)),
          totalLiabilitiesEquity: Number(totalLiabilitiesEquity.toFixed(2)),
          balanced,
        },
      },
    };
  } catch (err) {
    logger.error({ err }, 'Failed to load IC fund reports');
    return { success: false, error: 'Failed to load reports' };
  }
}

export async function getICWarehousePLReportAction(params: unknown): Promise<
  ActionResult<ICWarehousePLReport>
> {
  const parsed = icFundsDateRangeSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const access = await requireICFundsAccess(parsed.data.branchId, 'read');
  if (!access.ok) return { success: false, error: access.error };

  const { branchId, startDate, endDate } = parsed.data;
  const isHqLedger = isHqIcFundsBranchId(branchId);

  try {
    const asOfEnd = endDate ? new Date(`${endDate}T23:59:59.999Z`) : null;
    const periodStartMs = startDate ? new Date(`${startDate}T00:00:00.000Z`).getTime() : null;
    const periodEndMs = asOfEnd?.getTime() ?? null;

    const branchFilter = isHqLedger ? '' : `AND (w.branch_id = $1 OR w.branch_id IS NULL)`;
    const branchParams = isHqLedger ? [] : [branchId];

    const purchasesRes = await query(
      `SELECT
         p.warehouse_id,
         p.id,
         p.units,
         p.unit_rate,
         p.aed_total,
         p.created_at,
         w.name AS warehouse_name
       FROM ic_purchases p
       JOIN ic_warehouses w ON w.id = p.warehouse_id
       WHERE p.warehouse_id IS NOT NULL ${branchFilter}
       ORDER BY p.created_at ASC, p.id ASC`,
      branchParams,
    );

    const allSalesRes = await query(
      `SELECT
         s.id,
         s.units,
         s.unit_rate,
         s.aed_amount,
         s.service_charge,
         s.collected_units,
         s.warehouse_id,
         s.customer_name,
         s.order_customer_name,
         s.created_at,
         COALESCE(s.status_updated_at, s.created_at) AS sale_at,
         w.name AS warehouse_name
       FROM ic_sales s
       JOIN ic_warehouses w ON w.id = s.warehouse_id
       WHERE s.order_status = 'completed'
         AND s.warehouse_id IS NOT NULL
         ${branchFilter}
       ORDER BY sale_at ASC, s.created_at ASC, s.id ASC`,
      branchParams,
    );

    const warehouseMeta = new Map<string, string>();
    const eventsByWarehouse = new Map<string, WarehouseInventoryEvent[]>();
    const salesByWarehouse = new Map<
      string,
      Array<{
        id: string;
        saleAt: Date;
        customerName: string;
        warehouseName: string;
      }>
    >();

    for (const row of purchasesRes.rows) {
      const warehouseId = String(row.warehouse_id);
      warehouseMeta.set(warehouseId, String(row.warehouse_name ?? 'Warehouse'));
      const units = Number(row.units) || 0;
      const events = eventsByWarehouse.get(warehouseId) ?? [];
      events.push({
        kind: 'purchase',
        at: new Date(String(row.created_at)).getTime(),
        sortKey: String(row.id),
        units,
        cost: purchaseAedTotal(units, Number(row.unit_rate) || 0, row.aed_total),
      });
      eventsByWarehouse.set(warehouseId, events);
    }

    for (const row of allSalesRes.rows) {
      const warehouseId = String(row.warehouse_id);
      warehouseMeta.set(warehouseId, String(row.warehouse_name ?? 'Warehouse'));
      const saleAt = new Date(String(row.sale_at));
      const events = eventsByWarehouse.get(warehouseId) ?? [];
      events.push({
        kind: 'sale',
        at: saleAt.getTime(),
        sortKey: String(row.id),
        saleId: String(row.id),
        units: Number(row.units) || 0,
        collectedUnits: row.collected_units != null ? Number(row.collected_units) : null,
        unitRate: Number(row.unit_rate) || 0,
        aedAmount: Number(row.aed_amount) || 0,
        serviceCharge: Number(row.service_charge) || 0,
      });
      eventsByWarehouse.set(warehouseId, events);

      const sales = salesByWarehouse.get(warehouseId) ?? [];
      sales.push({
        id: String(row.id),
        saleAt,
        customerName: String(row.order_customer_name || row.customer_name || 'Customer'),
        warehouseName: String(row.warehouse_name ?? 'Warehouse'),
      });
      salesByWarehouse.set(warehouseId, sales);
    }

    const lines: ICWarehousePLReport['lines'] = [];
    const warehouseSummaries = new Map<
      string,
      {
        warehouseName: string;
        purchaseUnits: number;
        purchaseCost: number;
        weightedAvgRate: number;
        saleUnits: number;
        revenue: number;
        cogs: number;
        grossProfit: number;
      }
    >();

    for (const [warehouseId, allEvents] of eventsByWarehouse) {
      const cutoffMs = periodEndMs ?? Number.POSITIVE_INFINITY;
      const eventsThroughPeriod = allEvents.filter(e => e.at <= cutoffMs);
      const { pool, saleMargins } = simulateWarehouseInventory(eventsThroughPeriod);
      const warehouseName = warehouseMeta.get(warehouseId) ?? 'Warehouse';

      let periodSaleUnits = 0;
      let periodRevenue = 0;
      let periodCogs = 0;
      let periodGrossProfit = 0;

      for (const sale of salesByWarehouse.get(warehouseId) ?? []) {
        const saleMs = sale.saleAt.getTime();
        if (periodStartMs != null && saleMs < periodStartMs) continue;
        if (periodEndMs != null && saleMs > periodEndMs) continue;

        const margin = saleMargins.get(sale.id);
        if (!margin) continue;

        lines.push({
          saleId: sale.id,
          saleDate: isoDate(sale.saleAt),
          warehouseId,
          warehouseName: sale.warehouseName,
          customerName: sale.customerName,
          units: margin.deliveredUnits,
          saleRate: margin.saleRate,
          revenue: margin.revenue,
          avgPurchaseRate: margin.avgPurchaseRate,
          cogs: margin.cogs,
          grossProfit: margin.grossProfit,
          marginPct: margin.marginPct,
        });

        periodSaleUnits += margin.deliveredUnits;
        periodRevenue += margin.revenue;
        periodCogs += margin.cogs;
        periodGrossProfit += margin.grossProfit;
      }

      warehouseSummaries.set(warehouseId, {
        warehouseName,
        purchaseUnits: Number(pool.units.toFixed(4)),
        purchaseCost: Number(pool.cost.toFixed(2)),
        weightedAvgRate: Number(remainingStockWac(pool).toFixed(4)),
        saleUnits: Number(periodSaleUnits.toFixed(4)),
        revenue: Number(periodRevenue.toFixed(2)),
        cogs: Number(periodCogs.toFixed(2)),
        grossProfit: Number(periodGrossProfit.toFixed(2)),
      });
    }

    // Warehouses with purchases but no sales yet
    for (const [warehouseId, events] of eventsByWarehouse) {
      if (warehouseSummaries.has(warehouseId)) continue;
      const cutoffMs = periodEndMs ?? Number.POSITIVE_INFINITY;
      const { pool } = simulateWarehouseInventory(events.filter(e => e.at <= cutoffMs));
      warehouseSummaries.set(warehouseId, {
        warehouseName: warehouseMeta.get(warehouseId) ?? 'Warehouse',
        purchaseUnits: Number(pool.units.toFixed(4)),
        purchaseCost: Number(pool.cost.toFixed(2)),
        weightedAvgRate: Number(remainingStockWac(pool).toFixed(4)),
        saleUnits: 0,
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
      });
    }

    lines.sort((a, b) => a.saleDate.localeCompare(b.saleDate) || a.saleId.localeCompare(b.saleId));

    const warehouses = [...warehouseSummaries.entries()]
      .map(([warehouseId, summary]) => ({
        warehouseId,
        warehouseName: summary.warehouseName,
        purchaseUnits: summary.purchaseUnits,
        purchaseCost: summary.purchaseCost,
        weightedAvgRate: summary.weightedAvgRate,
        saleUnits: summary.saleUnits,
        revenue: summary.revenue,
        cogs: summary.cogs,
        grossProfit: summary.grossProfit,
      }))
      .filter(
        w =>
          w.saleUnits > 0 ||
          w.revenue > 0 ||
          w.purchaseUnits > 0 ||
          w.purchaseCost > 0,
      )
      .sort((a, b) => a.warehouseName.localeCompare(b.warehouseName));

    const totals = {
      saleUnits: Number(lines.reduce((s, l) => s + l.units, 0).toFixed(4)),
      revenue: Number(lines.reduce((s, l) => s + l.revenue, 0).toFixed(2)),
      cogs: Number(lines.reduce((s, l) => s + l.cogs, 0).toFixed(2)),
      grossProfit: Number(lines.reduce((s, l) => s + l.grossProfit, 0).toFixed(2)),
    };

    return {
      success: true,
      data: { lines, warehouses, totals },
    };
  } catch (err) {
    logger.error({ err }, 'Failed to load warehouse P&L report');
    return { success: false, error: 'Failed to load warehouse P&L' };
  }
}
