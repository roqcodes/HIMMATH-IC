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
import { assertManagerCustomerAllowedAtIcBranch } from '@/lib/icTransfer/icBranchManagerScope';
import { sortDealJournals } from '@/lib/icTransfer/warehouseJournalLabels';
import { ensureHqIcFundsBranch } from '@/lib/icFunds/ensureHqBranch';
import { HQ_IC_FUNDS_BRANCH_ID, HQ_IC_FUNDS_BRANCH_SLUG, isHqIcFundsBranch, isHqIcFundsBranchId } from '@/lib/icFunds/hqBranch';
import { relinkAedAgentLedgerAccounts } from '@/lib/counterparties/aedAgentSync';
import {
  accountBalanceSql,
  accountLedgerCreditSumSql,
  accountLedgerDebitSumSql,
  accountMovementJoinSql,
  accountPendingBalanceSql,
  accountPendingMovementJoinSql,
  inrAccountBalanceSql,
  inrAccountMovementJoinSql,
  inrAccountPendingMovementJoinSql,
  VOUCHER_LEDGER_STATUS_SQL,
} from '@/lib/icFunds/accountBalance';
import {
  accountPeriodBalanceSelectSql,
  accountPeriodLedgerSqlWithAgg,
  inrAccountPeriodBalanceSelectSql,
  inrAccountPeriodLedgerSqlWithAgg,
  mapRowToPeriodLedger,
  summarizeTrialBalanceTotals,
  toTrialBalanceRow,
  trialBalanceColumnsBalanced,
  type AccountPeriodLedger,
} from '@/lib/icFunds/accountPeriodBalance';
import {
  buildBalanceSheetPresentation,
  buildPlStatement,
  type BalanceSheetPresentation,
  type PlStatement,
} from '@/lib/icFunds/reportPresentation';
import { splitTradeReceivablesPayables } from '@/lib/icFunds/voucherPartyAccounts';
import {
  purchaseAedTotal,
  remainingStockWac,
  simulateWarehouseInventory,
  icUnitStockAt,
  icUnitStockThrough,
  sumIcUnitsInPeriod,
  metalStockAt,
  metalStockThrough,
  metalMovementInPeriod,
  type ICWarehousePLReport,
  type MetalWeightEvent,
  type WarehouseInventoryEvent,
} from '@/lib/icFunds/warehouseProfit';
import { resolveBranchTimeZone } from '@/lib/businessTime';
import { queryMetalPlPeriodKpis } from '@/lib/icFunds/metalPlPeriodKpis';
import type { ICFundProfitLossReport } from '@/lib/icFunds/plReportTypes';
import {
  summarizeSettlementTrades,
  resolveTradeUnitRateAed,
  tradeLinePaymentFromDb,
  type ICSettlementTradeLine,
  type ICSettlementTradeReport,
} from '@/lib/icFunds/settlementTradeReport';
import { sqlExcludeVoidIcSales } from '@/lib/icFunds/icTransferReportFilters';
import { isMetalAedPayment, normalizeMetalPaymentMethod } from '@/lib/domain/books';
import { bookedMetalAed, bookedMetalInr } from '@/lib/icTransfer/metalSplit';
import { syncICPurchaseToICFunds, syncICSaleToICFunds } from '@/lib/icFunds/icTransferFundSync';
import {
  buildIcStockInventoryEvents,
  isDealSaleActive,
} from '@/lib/icTransfer/dealProfit';
import type { ICPurchase, ICSale } from '@/types';
import { allocateLotAmount, computeMetalLotProfit } from '@/lib/icTransfer/metalInventory';
import { allocateMetalLotBookedCostAed, allocateMetalLotCostAed, allocateMetalLotCostInr } from '@/lib/icTransfer/metalLotCost';
import { netMetalInr } from '@/lib/icTransfer/labTest';
import { INR_PER_UNIT } from '@/lib/icTransfer/rateCalculations';
import { getFormattedTxnId } from '@/lib/icTransferMappers';
import { toIsoDateString } from '@/lib/toIsoDateString';
import { validateVoucherAccounts } from '@/lib/icFunds/voucherRules';
import { validateVoucherCurrencyPolicy, roundLedgerAmount } from '@/lib/icFunds/currencyPolicy';
import { ensureInrCashTill, postInrVoucherInTx } from '@/lib/ledgers/inr/inrFundSync';
import {
  buildVoucherListFilter,
  clampVoucherListLimit,
  clampVoucherListOffset,
  VOUCHER_DETAIL_SELECT_SQL,
  VOUCHER_FROM_SQL,
  VOUCHER_DETAIL_SELECT_COLUMNS,
  VOUCHER_LIST_SELECT_COLUMNS,
  VOUCHER_LIST_SELECT_SQL,
  VOUCHER_REPORT_MAX,
  INR_VOUCHER_LIST_SELECT_COLUMNS,
  INR_VOUCHER_FROM_SQL as INR_VOUCHER_FROM_SQL_SHARED,
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
  icFundProfitLossReportSchema,
  icFundsBooksReportSchema,
  icFundsDateRangeSchema,
  icSettlementTradeReportSchema,
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
    return { success: true, data: { id: HQ_IC_FUNDS_BRANCH_ID, slug: HQ_IC_FUNDS_BRANCH_SLUG } };
  } catch (err) {
    logger.error({ err }, 'ensureHqIcFundsBranchAction failed');
    return { success: false, error: 'Failed to prepare HQ IC Funds ledger.' };
  }
}

function isoDate(value: unknown): string {
  return toIsoDateString(value);
}

function mapAccount(
  row: Record<string, unknown>,
  opts?: { book?: 'AED' | 'INR' },
): ICFundAccount {
  const branchId = String(row.branch_id);
  const branchSlug = row.branch_slug ? String(row.branch_slug) : undefined;
  const book =
    opts?.book ?? (row.book === 'INR' ? 'INR' : row.book === 'AED' ? 'AED' : undefined);
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
    ledgerDebit: row.ledger_debit != null ? Number(row.ledger_debit) : undefined,
    ledgerCredit: row.ledger_credit != null ? Number(row.ledger_credit) : undefined,
    customerId:
      row.source_type === 'ic_counterparty' && row.source_id
        ? String(row.source_id)
        : row.source_type === 'ic_customer' && row.source_id
          ? String(row.source_id)
          : undefined,
    email: row.portal_email
      ? String(row.portal_email)
      : row.customer_email
        ? String(row.customer_email)
        : undefined,
    phone: row.customer_phone ? String(row.customer_phone) : undefined,
    hasPortalLogin: Boolean(row.customer_auth_user_id),
    sourceType: row.source_type ? String(row.source_type) : undefined,
    sourceId: row.source_id ? String(row.source_id) : undefined,
    book,
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
    book: row.book === 'INR' ? 'INR' : 'AED',
  };
}

/** Manual payment/receipt/journal rows must not reuse party id as reference_id — deal refs are 1:1 per entity. */
function accountingVoucherPartyRef(
  _voucherType: string,
  _debit: Record<string, unknown>,
  _credit: Record<string, unknown>,
): { referenceType: string; referenceId: string } | null {
  return null;
}

function isIcBranchFundAccount(row: Record<string, unknown>): boolean {
  return String(row.source_type ?? '').toLowerCase() === 'ic_branch';
}

function counterpartyIdFromFundAccount(row: Record<string, unknown>): string | null {
  if (String(row.source_type ?? '').toLowerCase() !== 'ic_counterparty') return null;
  const sid = String(row.source_id ?? '').trim();
  if (!sid || sid.startsWith('aed_agent:')) return null;
  return sid;
}

function icBranchIdFromFundAccount(row: Record<string, unknown>): string | null {
  if (!isIcBranchFundAccount(row)) return null;
  const sid = String(row.source_id ?? '').trim();
  return sid || null;
}

function accountBalanceSelectSql(opts?: {
  asOfParam?: string | null;
  branchParam?: string | null;
  accountParam?: string | null;
  includeLedgerTotals?: boolean;
}): string {
  const joinOpts = {
    asOfParam: opts?.asOfParam ?? undefined,
    branchParam: opts?.branchParam ?? undefined,
    accountParam: opts?.accountParam ?? undefined,
  };
  const movementJoin = accountMovementJoinSql(joinOpts);
  const pendingJoin = accountPendingMovementJoinSql(joinOpts);
  const branchParam = opts?.branchParam ?? '$1';
  const ledgerTotals = opts?.includeLedgerTotals
    ? `,
    ${accountLedgerDebitSumSql(branchParam, 'ic_fund_vouchers')} AS ledger_debit,
    ${accountLedgerCreditSumSql(branchParam, 'ic_fund_vouchers')} AS ledger_credit`
    : '';
  return `SELECT a.*, ${accountBalanceSql(opts?.asOfParam ?? null)} AS balance,
    ${accountPendingBalanceSql()} AS pending_balance${ledgerTotals},
    cp.email AS portal_email,
    cp.email AS customer_email,
    COALESCE(cp.phone, a.phone) AS customer_phone,
    NULL::uuid AS customer_auth_user_id,
    b.name AS branch_name,
    b.slug AS branch_slug
    FROM ic_fund_accounts a
    ${movementJoin}
    ${pendingJoin}
    LEFT JOIN ic_aed_agents ag_src
      ON a.source_type = 'ic_counterparty'
     AND a.source_id = ('aed_agent:' || ag_src.id::text)
    LEFT JOIN ic_counterparties cp ON (
      (a.source_type IN ('ic_counterparty', 'ic_customer') AND cp.id::text = a.source_id)
      OR cp.id = ag_src.counterparty_id
    )
    LEFT JOIN branches b ON b.id = a.branch_id`;
}

const RELATED_PURCHASE_PARTY_SQL = `(
  p.counterparty_id::text = $1
  OR EXISTS (
    SELECT 1 FROM ic_aed_agents aa
    WHERE aa.id = p.aed_agent_id
      AND (
        aa.counterparty_id::text = $1
        OR aa.id::text = $1
        OR ('aed_agent:' || aa.id::text) = $1
      )
  )
)`;

const RELATED_SALE_PARTY_SQL = `(
  s.counterparty_id::text = $1
  OR EXISTS (
    SELECT 1 FROM ic_aed_agents aa
    WHERE aa.id = s.aed_agent_id
      AND (
        aa.counterparty_id::text = $1
        OR aa.id::text = $1
        OR ('aed_agent:' || aa.id::text) = $1
      )
  )
)`;

async function fetchInrAccountsWithBalances(asOfDate?: string | null): Promise<ICFundAccount[]> {
  await withTransaction(async client => {
    await ensureInrCashTill(client, HQ_IC_FUNDS_BRANCH_ID);
  });
  const joinOpts = asOfDate
    ? { asOfParam: '$2', branchParam: '$1' }
    : { branchParam: '$1' };
  const params = asOfDate ? [HQ_IC_FUNDS_BRANCH_ID, asOfDate] : [HQ_IC_FUNDS_BRANCH_ID];
  const res = await query(
    `SELECT a.*, ${inrAccountBalanceSql(joinOpts.asOfParam ?? null)} AS balance,
      0::numeric AS pending_balance,
      b.name AS branch_name, b.slug AS branch_slug
     FROM inr_fund_accounts a
     ${inrAccountMovementJoinSql(joinOpts)}
     LEFT JOIN branches b ON b.id = a.branch_id
     WHERE a.branch_id = $1
     ORDER BY a.account_type, LOWER(a.name)`,
    params,
  );
  return res.rows.map(r => mapAccount(r as Record<string, unknown>, { book: 'INR' }));
}

async function fetchAccountsWithBalances(
  branchId: string,
  asOfDate?: string | null,
): Promise<ICFundAccount[]> {
  await relinkAedAgentLedgerAccounts();
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

async function fetchAccountPeriodLedgers(
  branchId: string,
  startDate?: string | null,
  endDate?: string | null,
): Promise<AccountPeriodLedger[]> {
  const branchParam = '$1';
  let startParam: string | null = null;
  let endParam: string | null = null;
  const params: unknown[] = [branchId];
  if (startDate) {
    params.push(startDate);
    startParam = '$2';
  }
  if (endDate) {
    params.push(endDate);
    endParam = startDate ? '$3' : '$2';
  }

  const pendingJoinOpts = endParam
    ? { asOfParam: endParam, branchParam: branchParam }
    : { branchParam: branchParam };

  const pendingJoin = accountPendingMovementJoinSql(pendingJoinOpts);

  const useAgg = startParam != null && endParam != null;
  const res = await query(
    useAgg
      ? `${accountPeriodLedgerSqlWithAgg(branchParam, startParam!, endParam!, accountPendingBalanceSql())}
       ${pendingJoin}
       WHERE a.branch_id = $1
       ORDER BY a.account_type, LOWER(a.name)`
      : `SELECT a.id, a.name, a.account_type, ${accountPeriodBalanceSelectSql({ branchParam, startParam, endParam })},
        ${accountPendingBalanceSql()} AS pending_balance
       FROM ic_fund_accounts a
       ${pendingJoin}
       WHERE a.branch_id = $1
       ORDER BY a.account_type, LOWER(a.name)`,
    params,
  );
  return res.rows.map(r => mapRowToPeriodLedger(r as Record<string, unknown>));
}

async function fetchInrAccountPeriodLedgers(
  branchId: string,
  startDate?: string | null,
  endDate?: string | null,
): Promise<AccountPeriodLedger[]> {
  const branchParam = '$1';
  let startParam: string | null = null;
  let endParam: string | null = null;
  const params: unknown[] = [branchId];
  if (startDate) {
    params.push(startDate);
    startParam = '$2';
  }
  if (endDate) {
    params.push(endDate);
    endParam = startDate ? '$3' : '$2';
  }

  const pendingJoinOpts = endParam
    ? { asOfParam: endParam, branchParam: branchParam }
    : { branchParam: branchParam };

  const pendingJoin = inrAccountPendingMovementJoinSql(pendingJoinOpts);

  const useAgg = startParam != null && endParam != null;
  const res = await query(
    useAgg
      ? `${inrAccountPeriodLedgerSqlWithAgg(branchParam, startParam!, endParam!, accountPendingBalanceSql())}
       ${pendingJoin}
       WHERE a.branch_id = $1
       ORDER BY a.account_type, LOWER(a.name)`
      : `SELECT a.id, a.name, a.account_type, ${inrAccountPeriodBalanceSelectSql({ branchParam, startParam, endParam })},
        ${accountPendingBalanceSql()} AS pending_balance
       FROM inr_fund_accounts a
       ${pendingJoin}
       WHERE a.branch_id = $1
       ORDER BY a.account_type, LOWER(a.name)`,
    params,
  );
  return res.rows.map(r => mapRowToPeriodLedger(r as Record<string, unknown>));
}

function buildTrialBalanceLines(
  ledgers: AccountPeriodLedger[],
): ICFundTrialBalanceLine[] {
  return ledgers
    .filter(
      a =>
        a.closing !== 0 ||
        a.opening !== 0 ||
        a.periodDebit !== 0 ||
        a.periodCredit !== 0 ||
        Math.abs(a.pendingBalance) > 0.00005,
    )
    .map(a => {
      const row = toTrialBalanceRow(a);
      return {
        accountId: row.accountId,
        accountName: row.accountName,
        accountType: row.accountType,
        debit: row.debit,
        credit: row.credit,
        pendingDebit: row.pendingDebit,
        pendingCredit: row.pendingCredit,
        openingDebit: row.openingDebit,
        openingCredit: row.openingCredit,
        periodDebit: row.periodDebit,
        periodCredit: row.periodCredit,
        closingDebit: row.closingDebit,
        closingCredit: row.closingCredit,
      };
    })
    .sort(
      (a, b) =>
        a.accountType.localeCompare(b.accountType) || a.accountName.localeCompare(b.accountName),
    );
}

const PL_ACCOUNT_TYPES_SQL = `('income', 'profit', 'expense', 'd_expense')`;
const EXPENSE_ACCOUNT_TYPES_SQL = `('expense', 'd_expense')`;

async function queryReportVouchers(opts: {
  branchId: string;
  startDate?: string;
  endDate?: string;
  book: 'AED' | 'INR';
  expenseOnly?: boolean;
  plOnly?: boolean;
}): Promise<{ vouchers: ICFundVoucher[]; truncated: boolean }> {
  const limit = VOUCHER_REPORT_MAX;
  const book = opts.book;
  const branchId = book === 'INR' ? HQ_IC_FUNDS_BRANCH_ID : opts.branchId;
  if (book === 'INR') {
    await withTransaction(async client => {
      await ensureInrCashTill(client, HQ_IC_FUNDS_BRANCH_ID);
    });
  }
  const fromSql = book === 'INR' ? INR_VOUCHER_FROM_SQL_SHARED : VOUCHER_FROM_SQL;
  const listColumns = book === 'INR' ? INR_VOUCHER_LIST_SELECT_COLUMNS : VOUCHER_LIST_SELECT_COLUMNS;
  const { clauses, values, nextIdx } = buildVoucherListFilter({
    branchId,
    startDate: opts.startDate,
    endDate: opts.endDate,
  });
  let typeClause = '';
  if (opts.expenseOnly) {
    typeClause = ` AND (da.account_type IN ${EXPENSE_ACCOUNT_TYPES_SQL} OR ca.account_type IN ${EXPENSE_ACCOUNT_TYPES_SQL})`;
  } else if (opts.plOnly) {
    typeClause = ` AND (da.account_type IN ${PL_ACCOUNT_TYPES_SQL} OR ca.account_type IN ${PL_ACCOUNT_TYPES_SQL})`;
  }
  const res = await query(
    `SELECT ${listColumns}, '${book}'::text AS book
     ${fromSql}
     WHERE ${clauses.join(' AND ')}${typeClause}
     ORDER BY v.voucher_date DESC, v.voucher_no DESC, v.created_at DESC
     LIMIT $${nextIdx}`,
    [...values, limit + 1],
  );
  const truncated = res.rows.length > limit;
  const rows = truncated ? res.rows.slice(0, limit) : res.rows;
  return { vouchers: rows.map(r => mapVoucher(r as Record<string, unknown>)), truncated };
}

async function queryVoucherRangeStatsForBook(
  branchId: string,
  opts: {
    startDate?: string;
    endDate?: string;
    book: 'AED' | 'INR';
    expenseOnly?: boolean;
  },
): Promise<ICFundVoucherRangeStats> {
  const book = opts.book;
  const ledgerBranch = book === 'INR' ? HQ_IC_FUNDS_BRANCH_ID : branchId;
  const fromSql = book === 'INR' ? INR_VOUCHER_FROM_SQL_SHARED : VOUCHER_FROM_SQL;
  const { clauses, values } = buildVoucherListFilter({
    branchId: ledgerBranch,
    startDate: opts.startDate,
    endDate: opts.endDate,
  });
  let typeClause = '';
  if (opts.expenseOnly) {
    typeClause = ` AND (da.account_type IN ${EXPENSE_ACCOUNT_TYPES_SQL} OR ca.account_type IN ${EXPENSE_ACCOUNT_TYPES_SQL})`;
  }
  const res = await query(
    `SELECT
       COUNT(*) FILTER (WHERE v.status <> 'void')::int AS entries,
       COUNT(*) FILTER (WHERE v.status = 'void')::int AS voided,
       COALESCE(SUM(v.amount) FILTER (WHERE v.status = 'active'), 0) AS total,
       COUNT(*) FILTER (WHERE v.status = 'active')::int AS posted_count,
       COUNT(*) FILTER (WHERE v.status = 'pending')::int AS pending_count,
       COALESCE(SUM(v.amount) FILTER (WHERE v.status = 'pending'), 0) AS pending_total,
       COALESCE(MAX(v.amount) FILTER (WHERE v.status = 'active'), 0) AS largest
     ${fromSql}
     WHERE ${clauses.join(' AND ')}${typeClause}`,
    values,
  );
  const row = res.rows[0] as Record<string, unknown> | undefined;
  return {
    entries: Number(row?.entries) || 0,
    voided: Number(row?.voided) || 0,
    total: Number(row?.total) || 0,
    posted: Number(row?.posted_count) || 0,
    pending: Number(row?.pending_count) || 0,
    pendingTotal: Number(row?.pending_total) || 0,
    largest: Number(row?.largest) || 0,
  };
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
  book?: 'AED' | 'INR';
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
    const book = params.book === 'INR' ? 'INR' : 'AED';
    if (book === 'INR') {
      await withTransaction(async client => {
        await ensureInrCashTill(client, HQ_IC_FUNDS_BRANCH_ID);
      });
    }
    const fromSql = book === 'INR' ? INR_VOUCHER_FROM_SQL_SHARED : VOUCHER_FROM_SQL;
    const listColumns = book === 'INR' ? INR_VOUCHER_LIST_SELECT_COLUMNS : VOUCHER_LIST_SELECT_COLUMNS;
    const statsBareFrom =
      book === 'INR' ? 'FROM inr_fund_vouchers v' : 'FROM ic_fund_vouchers v';
    const { clauses, values, nextIdx } = buildVoucherListFilter(
      book === 'INR' ? { ...params, branchId: HQ_IC_FUNDS_BRANCH_ID } : params,
    );
    const listSql = {
      text: `SELECT ${listColumns}, '${book}'::text AS book,
         COUNT(*) OVER()::int AS _total_count
       ${fromSql}
       WHERE ${clauses.join(' AND ')}
       ORDER BY v.voucher_date DESC, v.voucher_no DESC, v.created_at DESC
       LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      values: [...values, limit, offset],
    };

    const statsFromSql = params.search?.trim() ? fromSql : statsBareFrom;
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

function inrAccountBalanceSelectSql(opts: {
  branchParam: string;
  includeLedgerTotals?: boolean;
}): string {
  const movementJoin = inrAccountMovementJoinSql({ branchParam: opts.branchParam });
  const ledgerTotals = opts.includeLedgerTotals
    ? `,
    ${accountLedgerDebitSumSql(opts.branchParam, 'inr_fund_vouchers')} AS ledger_debit,
    ${accountLedgerCreditSumSql(opts.branchParam, 'inr_fund_vouchers')} AS ledger_credit`
    : '';
  return `SELECT a.*, ${inrAccountBalanceSql()} AS balance,
    0::numeric AS pending_balance${ledgerTotals},
    NULL::text AS customer_email,
    NULL::text AS customer_phone,
  b.name AS branch_name, b.slug AS branch_slug
  FROM inr_fund_accounts a
  ${movementJoin}
  LEFT JOIN branches b ON b.id = a.branch_id`;
}

/** Account list for voucher pickers (posted balance + lifetime Dr/Cr). */
export async function listICFundAccountsLiteAction(
  branchId: string,
  book: 'AED' | 'INR' = 'AED',
): Promise<ICFundAccount[]> {
  const access = await requireICFundsAccess(branchId, 'read');
  if (!access.ok) return [];
  try {
    if (book === 'INR') {
      await withTransaction(async client => {
        await ensureInrCashTill(client, HQ_IC_FUNDS_BRANCH_ID);
      });
      const res = await query(
        `${inrAccountBalanceSelectSql({ branchParam: '$1', includeLedgerTotals: true })}
         WHERE a.branch_id = $1
         ORDER BY a.account_type, LOWER(a.name)`,
        [HQ_IC_FUNDS_BRANCH_ID],
      );
      return res.rows.map(r => mapAccount(r as Record<string, unknown>));
    }

    await relinkAedAgentLedgerAccounts();
    const res = await query(
      `${accountBalanceSelectSql({ branchParam: '$1', includeLedgerTotals: true })}
       WHERE a.branch_id = $1
       ORDER BY a.account_type, LOWER(a.name)`,
      [branchId],
    );
    return res.rows.map(r => mapAccount(r as Record<string, unknown>));
  } catch (err) {
    logger.error({ err, branchId, book }, 'Failed to list lite IC fund accounts');
    return [];
  }
}

export async function listHQICFundAccountsAction(): Promise<ICFundAccount[]> {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') return [];
  try {
    await ensureHqIcFundsBranch();
    await relinkAedAgentLedgerAccounts();
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
        (a.source_type IN ('ic_counterparty', 'ic_customer') AND a.source_id = $2)
        OR (
          a.source_type = 'ic_counterparty'
          AND a.source_id IN (
            SELECT 'aed_agent:' || id::text FROM ic_aed_agents WHERE counterparty_id::text = $2
          )
        )
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

  if (parsed.data.requireSignIn) {
    return { success: false, error: 'Portal login for fund accounts is no longer supported.' };
  }

  const id = `ICFA-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
  const phone = parsed.data.phone?.trim() || null;

  try {
    await query(
      `INSERT INTO ic_fund_accounts (id, branch_id, name, account_type, opening_balance, notes, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        ledgerBranchId,
        parsed.data.name.trim(),
        parsed.data.accountType,
        roundLedgerAmount(Number(parsed.data.openingBalance) || 0),
        parsed.data.notes?.trim() ?? '',
        phone,
      ],
    );
    const res = await query(`${accountBalanceSelectSql({ accountParam: '$1' })} WHERE a.id = $1`, [id]);
    revalidatePath(`/${access.slug}/ic-funds/accounts`);
    revalidatePath(`/${access.slug}/counterparties`);
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
    if (parsed.data.openingBalance !== undefined) {
      push('opening_balance', roundLedgerAmount(Number(parsed.data.openingBalance) || 0));
    }
    if (parsed.data.notes !== undefined) push('notes', parsed.data.notes.trim());

    if (parsed.data.phone !== undefined) {
      push('phone', parsed.data.phone.trim() || null);
    }

    if (parsed.data.requireSignIn) {
      return { success: false, error: 'Portal login for fund accounts is no longer supported.' };
    }

    if (sets.length === 0 && parsed.data.phone === undefined) {
      return { success: false, error: 'No fields to update' };
    }

    if (sets.length > 0) {
      values.push(parsed.data.id, parsed.data.branchId);
      await query(
        `UPDATE ic_fund_accounts SET ${sets.join(', ')} WHERE id = $${idx} AND branch_id = $${idx + 1}`,
        values,
      );
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
  return { success: false, error: 'Portal login for fund accounts is no longer supported.' };
}

export async function listICFundVouchersAction(params: {
  branchId: string;
  voucherType?: ICFundVoucherType;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
  book?: 'AED' | 'INR';
}): Promise<ICFundVoucher[]> {
  const book = params.book === 'INR' ? 'INR' : 'AED';
  const branchId = book === 'INR' ? HQ_IC_FUNDS_BRANCH_ID : params.branchId;
  const access = await requireICFundsAccess(branchId, 'read');
  if (!access.ok) return [];

  const limit = clampVoucherListLimit(params.limit);
  const offset = clampVoucherListOffset(params.offset);

  try {
    if (book === 'INR') {
      await withTransaction(async client => {
        await ensureInrCashTill(client, HQ_IC_FUNDS_BRANCH_ID);
      });
    }
    const fromSql = book === 'INR' ? INR_VOUCHER_FROM_SQL_SHARED : VOUCHER_FROM_SQL;
    const listColumns = book === 'INR' ? INR_VOUCHER_LIST_SELECT_COLUMNS : VOUCHER_LIST_SELECT_COLUMNS;
    const filterParams = { ...params, branchId };
    const { clauses, values, nextIdx } = buildVoucherListFilter(filterParams);
    const res = await query(
      `SELECT ${listColumns}, '${book}'::text AS book
       ${fromSql}
       WHERE ${clauses.join(' AND ')}
       ORDER BY v.voucher_date DESC, v.voucher_no DESC, v.created_at DESC
       LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      [...values, limit, offset],
    );
    return res.rows.map(r => mapVoucher(r as Record<string, unknown>));
  } catch (err) {
    logger.error({ err, params, limit, offset, book }, 'Failed to list IC fund vouchers');
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

const WAREHOUSE_AED_PURCHASE_REFERENCE_TYPES = ['ic_purchase', 'metal_purchase_aed'] as const;
const WAREHOUSE_AED_SALE_REFERENCE_TYPES = [
  'ic_sale',
  'ic_sale_cogs',
  'ic_sale_profit',
  'metal_sale_aed',
  'metal_sale_ic_stock',
  'metal_fx_profit',
] as const;
const WAREHOUSE_INR_PURCHASE_REFERENCE_TYPES = ['metal_purchase', 'lab_test_purchase'] as const;
const WAREHOUSE_INR_SALE_REFERENCE_TYPES = [
  'metal_sale_cogs',
  'metal_sale_profit',
  'metal_sale_receipt',
  'lab_test_sale',
] as const;

/** IC Funds (AED) + INR metal journals for purchases, sales, COGS, and profit at a warehouse. */
export async function listWarehouseDealVouchersAction(params: {
  warehouseId: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<ICFundVoucher[]> {
  const warehouseId = String(params.warehouseId || '').trim();
  if (!warehouseId) return [];

  const whRes = await query<{ branch_id: string | null }>(
    `SELECT branch_id FROM ic_warehouses WHERE id = $1 LIMIT 1`,
    [warehouseId],
  );
  if (whRes.rows.length === 0) return [];

  const warehouseBranchId = whRes.rows[0].branch_id ? String(whRes.rows[0].branch_id) : null;
  const branchCandidates = [
    ...(warehouseBranchId ? [warehouseBranchId] : []),
    HQ_IC_FUNDS_BRANCH_ID,
  ];
  let accessOk = false;
  for (const branchId of branchCandidates) {
    const access = await requireICFundsAccess(branchId, 'read');
    if (access.ok) {
      accessOk = true;
      break;
    }
  }
  if (!accessOk) return [];

  const limit = clampVoucherListLimit(params.limit ?? 500);
  const startDate = params.startDate?.trim() || null;
  const endDate = params.endDate?.trim() || null;

  const dealDateSql = (alias: string) =>
    `AND ($3::date IS NULL OR ${alias}.created_at >= $3::date)
     AND ($4::date IS NULL OR ${alias}.created_at < ($4::date + interval '1 day'))`;

  const dealIdSql = (alias: string) => `CAST(${alias}.id AS text) = CAST(v.reference_id AS text)`;
  // Metal INR journals append account-role codes to reference_id (saleId#prcs).
  // Match the underlying deal so the grouped warehouse journal includes INR margin,
  // receipt and COGS alongside the AED FX voucher.
  const inrDealIdSql = (alias: string) =>
    `(CAST(${alias}.id AS text) = CAST(v.reference_id AS text)
      OR CAST(v.reference_id AS text) LIKE (CAST(${alias}.id AS text) || '#%'))`;

  const aedWhere = `(
      (v.reference_type = ANY($5::text[]) AND EXISTS (
        SELECT 1 FROM ic_purchases p
        WHERE ${dealIdSql('p')} AND p.warehouse_id = $1::uuid
        ${dealDateSql('p')}
      ))
      OR (v.reference_type = ANY($2::text[]) AND EXISTS (
        SELECT 1 FROM ic_sales s
        WHERE ${dealIdSql('s')} AND s.warehouse_id = $1::uuid
        ${dealDateSql('s')}
      ))
    )
    AND ($3::date IS NULL OR v.voucher_date >= $3::date)
    AND ($4::date IS NULL OR v.voucher_date <= $4::date)
    AND v.status IS DISTINCT FROM 'void'`;

  const inrWhere = `(
      (v.reference_type = ANY($2::text[]) AND EXISTS (
        SELECT 1 FROM ic_purchases p
        WHERE ${inrDealIdSql('p')} AND p.warehouse_id = $1::uuid
        ${dealDateSql('p')}
      ))
      OR (v.reference_type = ANY($6::text[]) AND EXISTS (
        SELECT 1 FROM ic_sales s
        WHERE ${inrDealIdSql('s')} AND s.warehouse_id = $1::uuid
        ${dealDateSql('s')}
      ))
    )
    AND ($3::date IS NULL OR v.voucher_date >= $3::date)
    AND ($4::date IS NULL OR v.voucher_date <= $4::date)
    AND v.status IS DISTINCT FROM 'void'`;

  try {
    const [aedRes, inrRes] = await Promise.all([
      query(
        `SELECT ${VOUCHER_DETAIL_SELECT_COLUMNS}, 'AED'::text AS book
         ${VOUCHER_FROM_SQL}
         WHERE ${aedWhere}
         ORDER BY v.voucher_date DESC, v.voucher_no DESC, v.created_at DESC
         LIMIT $6`,
        [
          warehouseId,
          [...WAREHOUSE_AED_SALE_REFERENCE_TYPES],
          startDate,
          endDate,
          [...WAREHOUSE_AED_PURCHASE_REFERENCE_TYPES],
          limit,
        ],
      ),
      query(
        `${INR_VOUCHER_DETAIL_SELECT_SQL}
         WHERE ${inrWhere}
         ORDER BY v.voucher_date DESC, v.voucher_no DESC, v.created_at DESC
         LIMIT $5`,
        [
          warehouseId,
          [...WAREHOUSE_INR_PURCHASE_REFERENCE_TYPES],
          startDate,
          endDate,
          limit,
          [...WAREHOUSE_INR_SALE_REFERENCE_TYPES],
        ],
      ),
    ]);

    const merged = [
      ...aedRes.rows.map(r => mapVoucher(r as Record<string, unknown>)),
      ...inrRes.rows.map(r => mapVoucher(r as Record<string, unknown>)),
    ];
    return sortDealJournals(merged).slice(0, limit);
  } catch (err) {
    logger.error({ err, warehouseId }, 'Failed to list warehouse deal vouchers');
    return [];
  }
}

/** Cash P&R posted against a UAE branch till or India warehouse till. */
export async function listLocationPartyVouchersAction(params: {
  voucherType: 'payment' | 'receipt';
  icBranchId?: string;
  warehouseId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<ICFundVoucher[]> {
  const icBranchId = params.icBranchId?.trim() || '';
  const warehouseId = params.warehouseId?.trim() || '';
  if (Boolean(icBranchId) === Boolean(warehouseId)) return [];

  const access = await requireICFundsAccess(HQ_IC_FUNDS_BRANCH_ID, 'read');
  if (!access.ok) return [];

  const limit = clampVoucherListLimit(params.limit ?? 500);
  const startDate = params.startDate?.trim() || null;
  const endDate = params.endDate?.trim() || null;
  const voucherType = params.voucherType;

  try {
    if (icBranchId) {
      const { icBranchTillSourceIdsForLookup } = await import('@/lib/icFunds/icBranchTill');
      const sourceIds = icBranchTillSourceIdsForLookup(icBranchId);
      const res = await query(
        `SELECT ${VOUCHER_DETAIL_SELECT_COLUMNS},
                'AED'::text AS book,
                v.manager_id::text AS manager_id,
                CASE
                  WHEN da.source_type IN ('ic_counterparty', 'ic_customer') THEN da.source_id
                  WHEN ca.source_type IN ('ic_counterparty', 'ic_customer') THEN ca.source_id
                  ELSE NULL
                END AS customer_id
         ${VOUCHER_FROM_SQL}
         WHERE v.branch_id = $1
           AND v.voucher_type = $2
           AND v.status IS DISTINCT FROM 'void'
           AND (
             (da.source_type = 'ic_branch' AND da.source_id = ANY($3::text[]))
             OR (ca.source_type = 'ic_branch' AND ca.source_id = ANY($3::text[]))
           )
           AND ($4::date IS NULL OR v.voucher_date >= $4::date)
           AND ($5::date IS NULL OR v.voucher_date <= $5::date)
         ORDER BY v.voucher_date DESC, v.voucher_no DESC, v.created_at DESC
         LIMIT $6`,
        [HQ_IC_FUNDS_BRANCH_ID, voucherType, sourceIds, startDate, endDate, limit],
      );
      return res.rows.map(r => ({
        ...mapVoucher(r as Record<string, unknown>),
        managerId: r.manager_id ? String(r.manager_id) : undefined,
        referenceId: r.customer_id ? String(r.customer_id) : r.reference_id ? String(r.reference_id) : undefined,
      }));
    }

    const res = await query(
      `SELECT
         v.id,
         v.branch_id,
         v.voucher_no,
         v.voucher_type,
         v.voucher_date,
         v.debit_account_id,
         v.credit_account_id,
         v.amount,
         v.notes,
         NULL::text AS created_by,
         v.created_by_name,
         NULL::text AS created_by_user_id,
         v.created_at,
         v.status,
         da.name AS debit_account_name,
         da.account_type AS debit_account_type,
         ca.name AS credit_account_name,
         ca.account_type AS credit_account_type,
         v.voided_at,
         NULL::text AS voided_by_name,
         v.reference_type,
         v.reference_id,
         v.manager_id::text AS manager_id,
         'INR'::text AS book
       ${INR_VOUCHER_FROM_SQL}
       WHERE v.branch_id = $1
         AND v.reference_type = 'party_pr'
         AND v.voucher_type = $2
         AND v.status = 'active'
         AND (
           (da.source_type = 'ic_warehouse' AND da.source_id = $3::text)
           OR (ca.source_type = 'ic_warehouse' AND ca.source_id = $3::text)
         )
         AND ($4::date IS NULL OR v.voucher_date >= $4::date)
         AND ($5::date IS NULL OR v.voucher_date <= $5::date)
       ORDER BY v.voucher_date DESC, v.voucher_no DESC, v.created_at DESC
       LIMIT $6`,
      [HQ_IC_FUNDS_BRANCH_ID, voucherType, warehouseId, startDate, endDate, limit],
    );
    return res.rows.map(r => ({
      ...mapVoucher(r as Record<string, unknown>),
      managerId: r.manager_id ? String(r.manager_id) : undefined,
    }));
  } catch (err) {
    logger.error({ err, icBranchId, warehouseId, voucherType }, 'listLocationPartyVouchersAction');
    return [];
  }
}

/** HQ AED journals for branch desk customer deposits (reference ic_branch_deposit). */
export async function listBranchDeskVouchersAction(params: {
  icBranchId: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<ICFundVoucher[]> {
  const icBranchId = String(params.icBranchId || '').trim();
  if (!icBranchId) return [];

  const access = await requireICFundsAccess(HQ_IC_FUNDS_BRANCH_ID, 'read');
  if (!access.ok) return [];

  const limit = clampVoucherListLimit(params.limit ?? 500);
  const startDate = params.startDate?.trim() || null;
  const endDate = params.endDate?.trim() || null;

  try {
    const res = await query(
      `SELECT ${VOUCHER_DETAIL_SELECT_COLUMNS}, 'AED'::text AS book
       ${VOUCHER_FROM_SQL}
       WHERE v.branch_id = $2
         AND v.reference_type = 'ic_branch_deposit'
         AND EXISTS (
           SELECT 1 FROM ic_branch_deposits d
           WHERE d.id::text = v.reference_id
             AND d.ic_branch_id = $1::uuid
         )
         AND ($3::date IS NULL OR v.voucher_date >= $3::date)
         AND ($4::date IS NULL OR v.voucher_date <= $4::date)
         AND v.status IS DISTINCT FROM 'void'
       ORDER BY v.voucher_date DESC, v.voucher_no DESC, v.created_at DESC
       LIMIT $5`,
      [icBranchId, HQ_IC_FUNDS_BRANCH_ID, startDate, endDate, limit],
    );
    return sortDealJournals(res.rows.map(r => mapVoucher(r as Record<string, unknown>)));
  } catch (err) {
    logger.error({ err, icBranchId }, 'Failed to list branch desk vouchers');
    return [];
  }
}

/** HQ till account auto-created for branch cash (Dr on customer deposits). */
export async function resolveBranchTillAccountAction(
  icBranchId: string,
): Promise<{ id: string; name: string; balance: number } | null> {
  const branchLockerId = String(icBranchId || '').trim();
  if (!branchLockerId) return null;
  const access = await requireICFundsAccess(HQ_IC_FUNDS_BRANCH_ID, 'read');
  if (!access.ok) return null;
  try {
    const { icBranchTillSourceIdsForLookup } = await import('@/lib/icFunds/icBranchTill');
    const sourceIds = icBranchTillSourceIdsForLookup(branchLockerId);
    const res = await query<{ id: string; name: string; balance: number | string }>(
      `SELECT a.id, a.name, ${accountBalanceSql()} AS balance
       FROM ic_fund_accounts a
       ${accountMovementJoinSql({ branchParam: '$1' })}
       WHERE a.branch_id = $1
         AND (
           (a.source_type = 'ic_branch' AND a.source_id = ANY($2::text[]))
           OR (a.source_type = 'ic_system' AND a.source_id = ANY($2::text[]))
         )
       ORDER BY CASE
         WHEN a.source_type = 'ic_branch' AND a.source_id = $3 THEN 0
         WHEN a.source_id = $3 THEN 1
         ELSE 2
       END
       LIMIT 1`,
      [HQ_IC_FUNDS_BRANCH_ID, sourceIds, branchLockerId],
    );
    if (res.rows.length === 0) return null;
    return {
      id: String(res.rows[0].id),
      name: String(res.rows[0].name),
      balance: Number(res.rows[0].balance) || 0,
    };
  } catch (err) {
    logger.error({ err, icBranchId: branchLockerId }, 'resolveBranchTillAccountAction');
    return null;
  }
}

const COUNTERPARTY_AED_SALE_REFERENCE_TYPES = ['ic_sale', 'ic_sale_cogs', 'ic_sale_profit', 'metal_sale_aed', 'metal_fx_profit'] as const;
const COUNTERPARTY_ACCOUNTING_REFERENCE_TYPES = [
  'ic_fund_payment',
  'ic_fund_receipt',
  'ic_fund_journal',
] as const;

const INR_VOUCHER_FROM_SQL = `
FROM inr_fund_vouchers v
JOIN inr_fund_accounts da ON da.id = v.debit_account_id
JOIN inr_fund_accounts ca ON ca.id = v.credit_account_id
`;

const INR_VOUCHER_DETAIL_SELECT_SQL = `
SELECT
  v.id,
  v.branch_id,
  v.voucher_no,
  v.voucher_type,
  v.voucher_date,
  v.debit_account_id,
  v.credit_account_id,
  v.amount,
  v.notes,
  NULL::text AS created_by,
  v.created_by_name,
  NULL::text AS created_by_user_id,
  v.created_at,
  v.status,
  da.name AS debit_account_name,
  da.account_type AS debit_account_type,
  ca.name AS credit_account_name,
  ca.account_type AS credit_account_type,
  v.voided_at,
  NULL::text AS voided_by_name,
  v.reference_type,
  v.reference_id,
  'INR'::text AS book
${INR_VOUCHER_FROM_SQL}
`;

/** IC Funds (AED) + INR metal journals for this counterparty. */
export async function listCounterpartyDealVouchersAction(params: {
  counterpartyId: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<ICFundVoucher[]> {
  const counterpartyId = String(params.counterpartyId || '').trim();
  if (!counterpartyId) return [];

  const cpRes = await query<{ branch_id: string | null }>(
    `SELECT branch_id FROM ic_counterparties WHERE id = $1 LIMIT 1`,
    [counterpartyId],
  );
  if (cpRes.rows.length === 0) return [];

  const cpBranchId = cpRes.rows[0].branch_id ? String(cpRes.rows[0].branch_id) : null;
  const branchCandidates = [...(cpBranchId ? [cpBranchId] : []), HQ_IC_FUNDS_BRANCH_ID];
  let accessOk = false;
  for (const branchId of branchCandidates) {
    const access = await requireICFundsAccess(branchId, 'read');
    if (access.ok) {
      accessOk = true;
      break;
    }
  }
  if (!accessOk) return [];

  try {
    await relinkAedAgentLedgerAccounts();
  } catch (err) {
    logger.warn({ err, counterpartyId }, 'relinkAedAgentLedgerAccounts skipped during journal list');
  }

  const limit = clampVoucherListLimit(params.limit ?? 500);
  const startDate = params.startDate?.trim() || null;
  const endDate = params.endDate?.trim() || null;

  const dealDateSql = (alias: string) =>
    `AND ($3::date IS NULL OR ${alias}.created_at >= $3::date)
     AND ($4::date IS NULL OR ${alias}.created_at < ($4::date + interval '1 day'))`;

  const agentOnPurchase = `EXISTS (
      SELECT 1 FROM ic_aed_agents aa
      WHERE aa.id = p.aed_agent_id AND aa.counterparty_id = $1::uuid
    )`;
  const agentOnSale = `EXISTS (
      SELECT 1 FROM ic_aed_agents aa
      WHERE aa.id = s.aed_agent_id AND aa.counterparty_id = $1::uuid
    )`;
  const dealIdSql = (alias: string) => `CAST(${alias}.id AS text) = CAST(v.reference_id AS text)`;
  const onPartyAccounts = `($6::varchar[] IS NOT NULL AND (v.debit_account_id = ANY($6::varchar[]) OR v.credit_account_id = ANY($6::varchar[])))`;
  const onAccountingRef = `(v.reference_type = ANY($7::text[]) AND v.reference_id = $1::text)`;

  const aedWhere = `(
      ${onPartyAccounts}
      OR ${onAccountingRef}
      OR (v.reference_type = 'ic_purchase' AND EXISTS (
        SELECT 1 FROM ic_purchases p
        WHERE ${dealIdSql('p')} AND p.counterparty_id = $1::uuid
        ${dealDateSql('p')}
      ))
      OR (v.reference_type = 'metal_purchase_aed' AND EXISTS (
        SELECT 1 FROM ic_purchases p
        WHERE ${dealIdSql('p')} AND ${agentOnPurchase}
        ${dealDateSql('p')}
      ))
      OR (
        v.reference_type = ANY($2::text[])
        AND v.reference_type <> 'metal_sale_aed'
        AND EXISTS (
          SELECT 1 FROM ic_sales s
          WHERE ${dealIdSql('s')} AND s.counterparty_id = $1::uuid
          ${dealDateSql('s')}
        )
      )
      OR (v.reference_type IN ('metal_sale_aed', 'metal_fx_profit') AND EXISTS (
        SELECT 1 FROM ic_sales s
        WHERE ${dealIdSql('s')} AND ${agentOnSale}
        ${dealDateSql('s')}
      ))
      OR (v.reference_type = 'ic_branch_deposit' AND EXISTS (
        SELECT 1 FROM ic_branch_deposits d
        WHERE d.id::text = v.reference_id
          AND (d.customer_id = $1::uuid OR d.manager_id = $1::uuid)
      ))
    )`;

  try {
    const [aedAccounts, inrAccounts] = await Promise.all([
      loadAedCounterpartyAccounts(counterpartyId),
      query(
        `SELECT id FROM inr_fund_accounts WHERE source_type = 'ic_counterparty' AND source_id = $1::text`,
        [counterpartyId],
      ),
    ]);
    const aedAccountIds = aedAccounts.map(r => String(r.id));
    const inrAccountIds = inrAccounts.rows.map(r => String(r.id));

    const [aedSettled, inrSettled] = await Promise.allSettled([
      query(
        `SELECT ${VOUCHER_DETAIL_SELECT_COLUMNS}, 'AED'::text AS book
         ${VOUCHER_FROM_SQL}
         WHERE ${aedWhere}
           AND ($3::date IS NULL OR v.voucher_date >= $3::date)
           AND ($4::date IS NULL OR v.voucher_date <= $4::date)
           AND v.status IS DISTINCT FROM 'void'
         ORDER BY v.voucher_date DESC, v.voucher_no DESC, v.created_at DESC
         LIMIT $5`,
        [
          counterpartyId,
          [...COUNTERPARTY_AED_SALE_REFERENCE_TYPES],
          startDate,
          endDate,
          limit,
          aedAccountIds.length ? aedAccountIds : null,
          [...COUNTERPARTY_ACCOUNTING_REFERENCE_TYPES],
        ],
      ),
      query(
        `${INR_VOUCHER_DETAIL_SELECT_SQL}
         WHERE (
           ($4::varchar[] IS NOT NULL AND (v.debit_account_id = ANY($4::varchar[]) OR v.credit_account_id = ANY($4::varchar[])))
           OR (v.reference_type = ANY($5::text[]) AND v.reference_id = $1::text)
           OR (
             v.reference_type = 'metal_sale_profit'
             AND EXISTS (
               SELECT 1 FROM ic_sales s
               WHERE s.counterparty_id = $1::uuid
                 AND (
                   CAST(s.id AS text) = CAST(v.reference_id AS text)
                   OR CAST(v.reference_id AS text) LIKE (CAST(s.id AS text) || '#%')
                 )
             )
           )
           OR (
             v.reference_type = 'metal_purchase_profit'
             AND EXISTS (
               SELECT 1 FROM ic_purchases p
               WHERE p.counterparty_id = $1::uuid
                 AND (
                   CAST(p.id AS text) = CAST(v.reference_id AS text)
                   OR CAST(v.reference_id AS text) LIKE (CAST(p.id AS text) || '#%')
                 )
             )
           )
         )
           AND ($2::date IS NULL OR v.voucher_date >= $2::date)
           AND ($3::date IS NULL OR v.voucher_date <= $3::date)
           AND v.status IS DISTINCT FROM 'void'
         ORDER BY v.voucher_date DESC, v.voucher_no DESC, v.created_at DESC
         LIMIT $6`,
        [
          counterpartyId,
          startDate,
          endDate,
          inrAccountIds.length ? inrAccountIds : null,
          [...COUNTERPARTY_ACCOUNTING_REFERENCE_TYPES],
          limit,
        ],
      ),
    ]);

    if (aedSettled.status === 'rejected') {
      logger.error({ err: aedSettled.reason, counterpartyId }, 'Failed to list counterparty AED journals');
    }
    if (inrSettled.status === 'rejected') {
      logger.error({ err: inrSettled.reason, counterpartyId }, 'Failed to list counterparty INR journals');
    }

    const merged = [
      ...(aedSettled.status === 'fulfilled'
        ? aedSettled.value.rows.map(r => mapVoucher(r as Record<string, unknown>))
        : []),
      ...(inrSettled.status === 'fulfilled'
        ? inrSettled.value.rows.map(r => mapVoucher(r as Record<string, unknown>))
        : []),
    ];
    return sortDealJournals(merged).slice(0, limit);
  } catch (err) {
    logger.error({ err, counterpartyId }, 'Failed to list counterparty deal vouchers');
    return [];
  }
}

export type CounterpartyBookSnapshot = {
  accountId: string | null;
  accountName: string | null;
  opening: number;
  periodDebit: number;
  periodCredit: number;
  closing: number;
};

export type CounterpartyLedgerKpis = {
  aed: CounterpartyBookSnapshot;
  inr: CounterpartyBookSnapshot;
};

const EMPTY_BOOK_SNAPSHOT: CounterpartyBookSnapshot = {
  accountId: null,
  accountName: null,
  opening: 0,
  periodDebit: 0,
  periodCredit: 0,
  closing: 0,
};

async function loadAedCounterpartyAccounts(counterpartyId: string) {
  const acc = await query(
    `SELECT id, name, opening_balance
     FROM ic_fund_accounts
     WHERE source_type IN ('ic_counterparty', 'ic_supplier', 'ic_customer')
       AND (
         source_id = $1::text
         OR source_id IN (
           SELECT 'aed_agent:' || id::text
           FROM ic_aed_agents
           WHERE counterparty_id = $1::uuid
         )
       )
     ORDER BY CASE source_type
       WHEN 'ic_counterparty' THEN 0
       WHEN 'ic_supplier' THEN 1
       ELSE 2
     END`,
    [counterpartyId],
  );
  return acc.rows as Record<string, unknown>[];
}

async function loadAedBookSnapshot(
  counterpartyId: string,
  startDate: string | null,
  endDate: string | null,
): Promise<CounterpartyBookSnapshot> {
  const rows = await loadAedCounterpartyAccounts(counterpartyId);
  return finishBookSnapshot(rows, 'ic_fund_vouchers', startDate, endDate);
}

async function loadInrBookSnapshot(
  counterpartyId: string,
  startDate: string | null,
  endDate: string | null,
): Promise<CounterpartyBookSnapshot> {
  const acc = await query(
    `SELECT id, name, opening_balance
     FROM inr_fund_accounts
     WHERE source_type = 'ic_counterparty' AND source_id = $1::text
     ORDER BY id`,
    [counterpartyId],
  );
  return finishBookSnapshot(acc.rows as Record<string, unknown>[], 'inr_fund_vouchers', startDate, endDate);
}

async function finishBookSnapshot(
  rows: Record<string, unknown>[] | Record<string, unknown> | undefined,
  voucherTable: 'ic_fund_vouchers' | 'inr_fund_vouchers',
  startDate: string | null,
  endDate: string | null,
): Promise<CounterpartyBookSnapshot> {
  const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
  if (list.length === 0) return { ...EMPTY_BOOK_SNAPSHOT };

  const accountIds = list.map(r => String(r.id));
  const openingBalance = list.reduce((sum, r) => sum + (Number(r.opening_balance) || 0), 0);
  const accountName = String(list[0].name || '');
  const fromSql =
    voucherTable === 'inr_fund_vouchers' ? 'inr_fund_vouchers v' : 'ic_fund_vouchers v';
  const posted = `COALESCE(v.status, 'active') = 'active'`;

  const beforeParams: unknown[] = [accountIds];
  let beforeSql = `
    SELECT
      COALESCE(SUM(CASE WHEN v.debit_account_id = ANY($1::varchar[]) THEN v.amount ELSE 0 END), 0) AS dr,
      COALESCE(SUM(CASE WHEN v.credit_account_id = ANY($1::varchar[]) THEN v.amount ELSE 0 END), 0) AS cr
    FROM ${fromSql}
    WHERE (v.debit_account_id = ANY($1::varchar[]) OR v.credit_account_id = ANY($1::varchar[]))
      AND ${posted}
  `;
  if (startDate) {
    beforeSql += ` AND v.voucher_date < $2::date`;
    beforeParams.push(startDate);
  } else {
    beforeSql += ` AND FALSE`;
  }
  const before = await query(beforeSql, beforeParams);
  const opening =
    openingBalance + (Number(before.rows[0]?.dr) || 0) - (Number(before.rows[0]?.cr) || 0);

  const periodParams: unknown[] = [accountIds];
  let periodSql = `
    SELECT
      COALESCE(SUM(CASE WHEN v.debit_account_id = ANY($1::varchar[]) THEN v.amount ELSE 0 END), 0) AS dr,
      COALESCE(SUM(CASE WHEN v.credit_account_id = ANY($1::varchar[]) THEN v.amount ELSE 0 END), 0) AS cr
    FROM ${fromSql}
    WHERE (v.debit_account_id = ANY($1::varchar[]) OR v.credit_account_id = ANY($1::varchar[]))
      AND ${posted}
  `;
  let idx = 2;
  if (startDate) {
    periodSql += ` AND v.voucher_date >= $${idx}::date`;
    periodParams.push(startDate);
    idx += 1;
  }
  if (endDate) {
    periodSql += ` AND v.voucher_date <= $${idx}::date`;
    periodParams.push(endDate);
  }
  const period = await query(periodSql, periodParams);
  const periodDebit = Number(period.rows[0]?.dr) || 0;
  const periodCredit = Number(period.rows[0]?.cr) || 0;
  const closing = opening + periodDebit - periodCredit;

  return {
    accountId: accountIds[0] ?? null,
    accountName,
    opening: Number(opening.toFixed(2)),
    periodDebit: Number(periodDebit.toFixed(2)),
    periodCredit: Number(periodCredit.toFixed(2)),
    closing: Number(closing.toFixed(2)),
  };
}

/** Re-sync split metal deals missing a party INR leg on the books. */
export async function repairCounterpartyMetalLedgersAction(
  counterpartyId: string,
): Promise<{ purchases: number; sales: number }> {
  const id = String(counterpartyId || '').trim();
  if (!id) return { purchases: 0, sales: 0 };
  try {
    const user = await getSessionUser();
    if (!user || user.role === 'customer') return { purchases: 0, sales: 0 };

    const [purchaseRes, saleRes] = await Promise.all([
      query<{ id: string }>(
        `SELECT p.id::text AS id FROM ic_purchases p
         WHERE p.settlement_mode = 'metal'
           AND p.counterparty_id = $1::uuid
           AND p.metal_payment_method = 'SPLIT'
           AND COALESCE(p.split_inr_paid, 0) > 0
           AND NOT EXISTS (
             SELECT 1 FROM inr_fund_vouchers v
             INNER JOIN inr_fund_accounts ca ON ca.id = v.credit_account_id
             WHERE v.status = 'active'
               AND v.reference_type = 'metal_purchase'
               AND (
                 v.reference_id = p.id::text
                 OR v.reference_id LIKE p.id::text || '#%'
               )
               AND ca.source_type = 'ic_counterparty'
               AND ca.source_id = $1::text
           )`,
        [id],
      ),
      query<{ id: string }>(
        `SELECT s.id::text AS id FROM ic_sales s
         WHERE s.settlement_mode = 'metal'
           AND COALESCE(s.order_status, '') = 'completed'
           AND s.metal_payment_method = 'SPLIT'
           AND COALESCE(s.split_inr_paid, 0) > 0
           AND s.counterparty_id = $1::uuid`,
        [id],
      ),
    ]);

    let purchases = 0;
    let sales = 0;
    for (const row of purchaseRes.rows) {
      try {
        await syncICPurchaseToICFunds(String(row.id));
        purchases += 1;
      } catch (err) {
        logger.error({ err, purchaseId: row.id, counterpartyId: id }, 'repairCounterpartyMetalLedgers purchase');
      }
    }
    for (const row of saleRes.rows) {
      try {
        await syncICSaleToICFunds(String(row.id));
        sales += 1;
      } catch (err) {
        logger.error({ err, saleId: row.id, counterpartyId: id }, 'repairCounterpartyMetalLedgers sale');
      }
    }
    return { purchases, sales };
  } catch (err) {
    logger.error({ err, counterpartyId: id }, 'repairCounterpartyMetalLedgersAction');
    return { purchases: 0, sales: 0 };
  }
}

/** Opening / period Dr-Cr / closing for this counterparty on AED and INR books. */

export async function getCounterpartyLedgerKpisAction(params: {
  counterpartyId: string;
  startDate?: string;
  endDate?: string;
}): Promise<CounterpartyLedgerKpis> {
  const counterpartyId = String(params.counterpartyId || '').trim();
  const empty = { aed: { ...EMPTY_BOOK_SNAPSHOT }, inr: { ...EMPTY_BOOK_SNAPSHOT } };
  if (!counterpartyId) return empty;

  const cpRes = await query<{ branch_id: string | null }>(
    `SELECT branch_id FROM ic_counterparties WHERE id = $1 LIMIT 1`,
    [counterpartyId],
  );
  if (cpRes.rows.length === 0) return empty;

  const cpBranchId = cpRes.rows[0].branch_id ? String(cpRes.rows[0].branch_id) : null;
  const branchCandidates = [...(cpBranchId ? [cpBranchId] : []), HQ_IC_FUNDS_BRANCH_ID];
  let accessOk = false;
  for (const branchId of branchCandidates) {
    const access = await requireICFundsAccess(branchId, 'read');
    if (access.ok) {
      accessOk = true;
      break;
    }
  }
  if (!accessOk) return empty;

  try {
    await relinkAedAgentLedgerAccounts();
  } catch (err) {
    logger.warn({ err, counterpartyId }, 'relinkAedAgentLedgerAccounts skipped during KPI load');
  }

  const startDate = params.startDate?.trim() || null;
  const endDate = params.endDate?.trim() || null;

  try {
    const [aed, inr] = await Promise.all([
      loadAedBookSnapshot(counterpartyId, startDate, endDate),
      loadInrBookSnapshot(counterpartyId, startDate, endDate),
    ]);
    return { aed, inr };
  } catch (err) {
    logger.error({ err, counterpartyId }, 'Failed to load counterparty ledger KPIs');
    return empty;
  }
}

export async function postICFundVoucherAction(input: unknown): Promise<ActionResult<ICFundVoucher>> {
  const parsed = postICFundVoucherSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const access = await requireICFundsAccess(parsed.data.branchId, 'write');
  if (!access.ok) return { success: false, error: access.error };

  const amount = roundLedgerAmount(Number(parsed.data.amount));
  if (amount <= 0) return { success: false, error: 'Amount must be greater than zero' };

  if (parsed.data.book === 'INR') {
    if (parsed.data.voucherType !== 'payment' && parsed.data.voucherType !== 'receipt') {
      return { success: false, error: 'INR book supports payments and receipts only.' };
    }
    try {
      const id = await withTransaction(async client => {
        await ensureInrCashTill(client, HQ_IC_FUNDS_BRANCH_ID);
        const accounts = await client.query(
          `SELECT id, account_type, status, branch_id, source_type, source_id
           FROM inr_fund_accounts
           WHERE id = ANY($1::varchar[]) AND branch_id = $2
           ORDER BY id
           FOR UPDATE`,
          [[parsed.data.debitAccountId, parsed.data.creditAccountId], HQ_IC_FUNDS_BRANCH_ID],
        );
        if (accounts.rows.length !== 2) {
          throw new Error('One or both accounts were not found');
        }
        const debit = accounts.rows.find(r => String(r.id) === parsed.data.debitAccountId);
        const credit = accounts.rows.find(r => String(r.id) === parsed.data.creditAccountId);
        if (!debit || !credit) throw new Error('One or both accounts were not found');
        if (debit.status !== 'active' || credit.status !== 'active') {
          throw new Error('Inactive accounts cannot be used');
        }
        const ruleError = validateVoucherAccounts({
          voucherType: parsed.data.voucherType,
          debitType: debit.account_type as ICFundAccountType,
          creditType: credit.account_type as ICFundAccountType,
          debitId: parsed.data.debitAccountId,
          creditId: parsed.data.creditAccountId,
        });
        if (ruleError) throw new Error(ruleError);
        const partyRef = accountingVoucherPartyRef(parsed.data.voucherType, debit, credit);
        const voucherId = await postInrVoucherInTx(client, {
          branchId: HQ_IC_FUNDS_BRANCH_ID,
          voucherType: parsed.data.voucherType,
          voucherDate: parsed.data.voucherDate,
          debitAccountId: parsed.data.debitAccountId,
          creditAccountId: parsed.data.creditAccountId,
          amount,
          notes: parsed.data.notes?.trim() ?? '',
          createdByName: access.user.name ?? access.user.id ?? null,
          referenceType: partyRef?.referenceType ?? null,
          referenceId: partyRef?.referenceId ?? null,
          managerId: parsed.data.managerId ?? null,
          aedAgentId: parsed.data.aedAgentId?.trim() || null,
        });
        if (!voucherId) throw new Error('Failed to save voucher');
        return voucherId;
      });
      await writeAuditLog({
        actor: access.user,
        action: 'create',
        entityType: 'inr_fund_voucher',
        entityId: id,
        branchId: HQ_IC_FUNDS_BRANCH_ID,
        after: { voucherType: parsed.data.voucherType, amount, book: 'INR' },
      });
      revalidatePath('/admin/counterparties');
      revalidatePath('/admin/payments');
      revalidatePath('/admin/receipts');
      const res = await query(`${INR_VOUCHER_DETAIL_SELECT_SQL} WHERE v.id = $1`, [id]);
      return { success: true, data: mapVoucher(res.rows[0] as Record<string, unknown>) };
    } catch (err) {
      logger.error({ err }, 'Failed to post INR fund voucher');
      return { success: false, error: err instanceof Error ? err.message : 'Failed to save voucher' };
    }
  }

  try {
    const id = await withTransaction(async (client) => {
      if (parsed.data.idempotencyKey) {
        const dup = await client.query(
          `SELECT id FROM ic_fund_vouchers WHERE idempotency_key = $1 LIMIT 1`,
          [parsed.data.idempotencyKey],
        );
        if (dup.rows.length > 0) return String(dup.rows[0].id);
      }

      const accounts = await client.query(
        `SELECT id, account_type, status, branch_id, source_type, source_id
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
        debitType: debit.account_type as ICFundAccountType,
        creditType: credit.account_type as ICFundAccountType,
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

      const icBranchId = icBranchIdFromFundAccount(debit) ?? icBranchIdFromFundAccount(credit);
      if (icBranchId) {
        if (!parsed.data.managerId?.trim()) {
          throw new Error('Manager is required when using a branch locker.');
        }
        const customerId =
          counterpartyIdFromFundAccount(debit) ?? counterpartyIdFromFundAccount(credit);
        if (customerId) {
          const scopeErr = await assertManagerCustomerAllowedAtIcBranch({
            icBranchId,
            managerId: parsed.data.managerId,
            customerId,
          });
          if (scopeErr) throw new Error(scopeErr.error);
        }
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
      const partyRef = accountingVoucherPartyRef(parsed.data.voucherType, debit, credit);

      await client.query(
        `INSERT INTO ic_fund_vouchers (
           id, branch_id, voucher_no, voucher_type, voucher_date,
           debit_account_id, credit_account_id, amount, notes,
           created_by, created_by_name, created_by_user_id,
           reference_type, reference_id, idempotency_key, manager_id, aed_agent_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
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
          partyRef?.referenceType ?? null,
          partyRef?.referenceId ?? null,
          parsed.data.idempotencyKey ?? null,
          parsed.data.managerId ?? null,
          parsed.data.aedAgentId?.trim() || null,
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

    revalidatePath('/admin/counterparties');
    revalidatePath('/admin/payments');
    revalidatePath('/admin/receipts');
    const res = await query(`${VOUCHER_DETAIL_SELECT_SQL} WHERE v.id = $1`, [id]);
    return { success: true, data: mapVoucher(res.rows[0] as Record<string, unknown>) };
  } catch (err) {
    logger.error({ err }, 'Failed to post IC fund voucher');
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save voucher' };
  }
}

function ledgerBookForVoucherId(voucherId: string): 'AED' | 'INR' {
  return voucherId.startsWith('INFV-') ? 'INR' : 'AED';
}

export async function deleteICFundVoucherAction(
  branchId: string,
  voucherId: string,
  _book: 'AED' | 'INR' = 'AED',
): Promise<ActionResult<{ id: string }>> {
  const ledgerBook = ledgerBookForVoucherId(voucherId);
  const voucherTable = ledgerBook === 'INR' ? 'inr_fund_vouchers' : 'ic_fund_vouchers';

  const lookup = await query(
    `SELECT branch_id, status FROM ${voucherTable} WHERE id = $1 LIMIT 1`,
    [voucherId],
  );
  if (lookup.rows.length === 0) {
    return { success: false, error: 'Voucher not found' };
  }
  const voucherBranchId = String(lookup.rows[0].branch_id);
  const voucherStatus = String(lookup.rows[0].status ?? 'active');
  if (voucherStatus === 'void') {
    return { success: false, error: 'Voucher is already void' };
  }

  const access = await requireICFundsAccess(voucherBranchId, 'write');
  if (!access.ok) return { success: false, error: access.error };

  if (ledgerBook === 'INR') {
    try {
      await withTransaction(async client => {
        const res = await client.query(
          `UPDATE inr_fund_vouchers
           SET status = 'void',
               voided_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND branch_id = $2 AND status = 'active'
           RETURNING id`,
          [voucherId, voucherBranchId],
        );
        if (res.rows.length === 0) throw new Error('Voucher could not be voided');
        const { voidCapitalAllocationsForVoucher } = await import('@/lib/capital/allocation');
        await voidCapitalAllocationsForVoucher(client, voucherId, 'INR');
      });
      await writeAuditLog({
        actor: access.user,
        action: 'void',
        entityType: 'inr_fund_voucher',
        entityId: voucherId,
        branchId: voucherBranchId,
      });
      revalidatePath('/admin/counterparties');
      revalidatePath('/admin/payments');
      revalidatePath('/admin/receipts');
      revalidatePath('/admin/capital');
      return { success: true, data: { id: voucherId } };
    } catch (err) {
      logger.error({ err, voucherId }, 'Failed to void INR fund voucher');
      return { success: false, error: 'Failed to void voucher' };
    }
  }

  try {
    await withTransaction(async client => {
      const res = await client.query(
        `UPDATE ic_fund_vouchers
         SET status = 'void',
             voided_at = CURRENT_TIMESTAMP,
             voided_by_name = $3
         WHERE id = $1 AND branch_id = $2 AND status = 'active'
         RETURNING id`,
        [voucherId, voucherBranchId, access.user.name ?? access.user.id ?? 'User'],
      );
      if (res.rows.length === 0) throw new Error('Voucher could not be voided');
      const { voidCapitalAllocationsForVoucher } = await import('@/lib/capital/allocation');
      await voidCapitalAllocationsForVoucher(client, voucherId, 'AED');
    });
    await writeAuditLog({
      actor: access.user,
      action: 'void',
      entityType: 'ic_fund_voucher',
      entityId: voucherId,
      branchId: voucherBranchId,
    });
    revalidatePath('/admin/counterparties');
    revalidatePath('/admin/payments');
    revalidatePath('/admin/receipts');
    revalidatePath('/admin/capital');
    return { success: true, data: { id: voucherId } };
  } catch (err) {
    logger.error({ err, voucherId, branchId }, 'Failed to void IC fund voucher');
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to void voucher',
    };
  }
}

export type ICManagerDealStatementLine = {
  date: string;
  voucherNo: number;
  voucherType: string;
  entryLabel: string;
  fromParty: string;
  toParty: string;
  book: 'AED' | 'INR';
  amount: number;
  notes: string;
};

export type ICManagerDealStatement = {
  managerId: string;
  managerName: string;
  lines: ICManagerDealStatementLine[];
};

/** Journal activity for deals tagged to a manager; this is not a manager ledger. */
export async function getICManagerDealStatementAction(params: {
  branchId: string;
  managerId: string;
  startDate?: string;
  endDate?: string;
}): Promise<ActionResult<ICManagerDealStatement>> {
  const access = await requireICFundsAccess(params.branchId, 'read');
  if (!access.ok) return { success: false, error: access.error };

  try {
    const managerRes = await query(
      `SELECT name FROM ic_counterparties WHERE id = $1 AND kind = 'manager' LIMIT 1`,
      [params.managerId],
    );
    if (managerRes.rows.length === 0) return { success: false, error: 'Manager not found' };

    const select = (
      table: 'ic_fund_vouchers' | 'inr_fund_vouchers',
      accountsTable: 'ic_fund_accounts' | 'inr_fund_accounts',
      book: 'AED' | 'INR',
    ) =>
      query(
        `SELECT
           $5::text AS book,
           v.voucher_date::text AS date,
           v.voucher_no,
           v.voucher_type,
           CASE
             WHEN v.reference_type = 'ic_purchase' THEN 'Purchase'
             WHEN v.reference_type = 'metal_purchase_aed' THEN 'Metal Purchase AED'
             WHEN v.reference_type = 'metal_purchase' THEN 'Metal Purchase INR'
             WHEN v.reference_type = 'ic_sale' THEN 'Sale'
             WHEN v.reference_type = 'metal_sale_aed' THEN 'Metal Sold AED'
             WHEN v.reference_type = 'metal_sale_receipt' THEN 'Metal Sold INR'
             WHEN v.reference_type = 'ic_fund_payment' THEN 'Payment'
             WHEN v.reference_type = 'ic_fund_receipt' THEN 'Receipt'
             WHEN v.reference_type = 'ic_branch_deposit' THEN 'Branch Deposit'
             WHEN v.reference_type IS NULL AND v.voucher_type = 'payment' THEN 'Payment'
             WHEN v.reference_type IS NULL AND v.voucher_type = 'receipt' THEN 'Receipt'
             ELSE 'Journal entry'
           END AS entry_label,
           CASE
             WHEN p.id IS NOT NULL THEN COALESCE(party_from.name, 'Supplier')
             WHEN s.id IS NOT NULL THEN COALESCE(warehouse.name, 'Company')
             WHEN d.id IS NOT NULL THEN COALESCE(deposit_customer.name, 'Customer')
             WHEN v.reference_type IN ('ic_fund_payment', 'ic_fund_receipt') THEN COALESCE(ca.name, '—')
             ELSE COALESCE(ca.name, '—')
           END AS from_party,
           CASE
             WHEN p.id IS NOT NULL THEN COALESCE(warehouse.name, 'Company')
             WHEN s.id IS NOT NULL THEN COALESCE(NULLIF(s.customer_name, ''), NULLIF(s.order_customer_name, ''), party_to.name, 'Customer')
             WHEN d.id IS NOT NULL THEN COALESCE(deposit_manager.name, 'Manager')
             ELSE COALESCE(da.name, '—')
           END AS to_party,
           v.amount,
           v.notes
         FROM ${table} v
         LEFT JOIN ic_purchases p
           ON v.reference_type IN ('ic_purchase', 'metal_purchase_aed', 'metal_purchase')
          AND (CAST(v.reference_id AS text) = p.id::text
           OR CAST(v.reference_id AS text) LIKE (p.id::text || '#%'))
         LEFT JOIN ic_sales s
           ON v.reference_type IN ('ic_sale', 'metal_sale_aed', 'metal_sale_receipt')
          AND (CAST(v.reference_id AS text) = s.id::text
           OR CAST(v.reference_id AS text) LIKE (s.id::text || '#%'))
         LEFT JOIN ic_branch_deposits d
           ON v.reference_type = 'ic_branch_deposit' AND d.id::text = CAST(v.reference_id AS text)
         LEFT JOIN ic_counterparties party_from ON party_from.id = p.counterparty_id
         LEFT JOIN ic_counterparties party_to ON party_to.id = s.counterparty_id
         LEFT JOIN ic_warehouses warehouse ON warehouse.id = COALESCE(p.warehouse_id, s.warehouse_id)
         LEFT JOIN ic_counterparties deposit_customer ON deposit_customer.id = d.customer_id
         LEFT JOIN ic_counterparties deposit_manager ON deposit_manager.id = d.manager_id
         LEFT JOIN ${accountsTable} da ON da.id = v.debit_account_id
         LEFT JOIN ${accountsTable} ca ON ca.id = v.credit_account_id
         WHERE v.branch_id = $1
           AND COALESCE(v.status, 'active') <> 'void'
           AND (
             v.reference_type = ANY($6::text[])
             OR (v.reference_type IS NULL AND v.voucher_type IN ('payment', 'receipt') AND v.manager_id = $2)
           )
           AND (
             p.manager_id = $2 OR s.manager_id = $2 OR v.manager_id = $2 OR d.manager_id = $2
           )
           AND ($3::date IS NULL OR v.voucher_date >= $3::date)
           AND ($4::date IS NULL OR v.voucher_date <= $4::date)
         ORDER BY v.voucher_date, v.voucher_no, v.created_at`,
        [
          params.branchId,
          params.managerId,
          params.startDate ?? null,
          params.endDate ?? null,
          book,
          book === 'AED'
            ? ['ic_purchase', 'metal_purchase_aed', 'ic_sale', 'metal_sale_aed', 'ic_fund_payment', 'ic_fund_receipt', 'ic_branch_deposit']
            : ['metal_purchase', 'metal_sale_receipt', 'ic_fund_payment', 'ic_fund_receipt'],
        ],
      );

    const [aedRows, inrRows] = await Promise.all([
      select('ic_fund_vouchers', 'ic_fund_accounts', 'AED'),
      select('inr_fund_vouchers', 'inr_fund_accounts', 'INR'),
    ]);
    const lines = [...aedRows.rows, ...inrRows.rows]
      .map(row => ({
        date: String(row.date || ''),
        voucherNo: Number(row.voucher_no) || 0,
        voucherType: String(row.voucher_type || 'journal'),
        entryLabel: String(row.entry_label || 'Journal entry'),
        fromParty: String(row.from_party || '—'),
        toParty: String(row.to_party || '—'),
        book: String(row.book) as 'AED' | 'INR',
        amount: Number(row.amount) || 0,
        notes: String(row.notes || ''),
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.voucherNo - b.voucherNo || a.book.localeCompare(b.book));

    return {
      success: true,
      data: {
        managerId: params.managerId,
        managerName: String(managerRes.rows[0].name || 'Manager'),
        lines,
      },
    };
  } catch (err) {
    logger.error({ err, managerId: params.managerId }, 'Failed to load manager deal statement');
    return { success: false, error: 'Failed to load manager activity statement' };
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
      `SELECT ${VOUCHER_DETAIL_SELECT_COLUMNS},
         COALESCE(debit_branch.name, credit_branch.name, deposit_branch.name) AS transaction_branch_name
       ${VOUCHER_FROM_SQL}
       LEFT JOIN ic_branch_deposits statement_deposit
         ON v.reference_type = 'ic_branch_deposit'
        AND statement_deposit.id::text = v.reference_id
       LEFT JOIN ic_branches debit_branch
         ON da.source_type = 'ic_branch'
        AND (debit_branch.id::text = da.source_id
          OR 'branch_cash_wh_' || debit_branch.id::text = da.source_id
          OR debit_branch.id = statement_deposit.ic_branch_id)
       LEFT JOIN ic_branches credit_branch
         ON ca.source_type = 'ic_branch'
        AND (credit_branch.id::text = ca.source_id
          OR 'branch_cash_wh_' || credit_branch.id::text = ca.source_id
          OR credit_branch.id = statement_deposit.ic_branch_id)
       LEFT JOIN ic_branches deposit_branch ON deposit_branch.id = statement_deposit.ic_branch_id
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
      const particulars =
        v.referenceType === 'metal_purchase_aed'
          ? 'Metal Purchase AED'
          : v.referenceType === 'metal_sale_aed'
            ? 'Metal Sold AED'
            : v.referenceType === 'metal_fx_profit'
              ? 'Metal FX Profit (AED)'
              : counterparty;
      lines.push({
        date: v.voucherDate,
        branchName: row.transaction_branch_name ? String(row.transaction_branch_name) : undefined,
        voucherNo: v.voucherNo,
        voucherType: v.voucherType,
        particulars,
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

type InrFundStatementAccount = {
  id: string;
  name: string;
  openingBalance: number;
  sourceType?: string;
  sourceId?: string;
};

function mapInrStatementAccount(row: Record<string, unknown>): InrFundStatementAccount {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    openingBalance: Number(row.opening_balance) || 0,
    sourceType: row.source_type ? String(row.source_type) : undefined,
    sourceId: row.source_id ? String(row.source_id) : undefined,
  };
}

/** Resolve INR metal ledger account linked to an AED IC Funds account (counterparty). */
export async function resolveInrFundAccountIdForIcFundAccountAction(params: {
  branchId: string;
  icFundAccountId: string;
}): Promise<ActionResult<{ inrAccountId: string | null; inrAccountName?: string }>> {
  const access = await requireICFundsAccess(params.branchId, 'read');
  if (!access.ok) return { success: false, error: access.error };

  try {
    const accRes = await query(
      `SELECT source_type, source_id FROM ic_fund_accounts WHERE id = $1 AND branch_id = $2 LIMIT 1`,
      [params.icFundAccountId, params.branchId],
    );
    if (accRes.rows.length === 0) return { success: true, data: { inrAccountId: null } };
    const sourceType = String(accRes.rows[0].source_type ?? '');
    const sourceId = String(accRes.rows[0].source_id ?? '');
    if (!sourceId || !['ic_counterparty', 'ic_supplier', 'ic_customer'].includes(sourceType)) {
      return { success: true, data: { inrAccountId: null } };
    }
    const inrRes = await query(
      `SELECT id, name FROM inr_fund_accounts
       WHERE source_type = 'ic_counterparty' AND source_id = $1
       LIMIT 1`,
      [sourceId],
    );
    if (inrRes.rows.length === 0) return { success: true, data: { inrAccountId: null } };
    return {
      success: true,
      data: {
        inrAccountId: String(inrRes.rows[0].id),
        inrAccountName: String(inrRes.rows[0].name ?? ''),
      },
    };
  } catch (err) {
    logger.error({ err, params }, 'Failed to resolve INR fund account');
    return { success: false, error: 'Failed to resolve INR account' };
  }
}

export async function getInrFundStatementAction(params: {
  branchId: string;
  accountId: string;
  startDate?: string;
  endDate?: string;
}): Promise<
  ActionResult<{
    account: InrFundStatementAccount;
    opening: number;
    lines: ICFundStatementLine[];
    closing: number;
    currency: 'INR';
  }>
> {
  const access = await requireICFundsAccess(params.branchId, 'read');
  if (!access.ok) return { success: false, error: access.error };

  try {
    const accRes = await query(
      `SELECT id, name, opening_balance, source_type, source_id
       FROM inr_fund_accounts WHERE id = $1 LIMIT 1`,
      [params.accountId],
    );
    if (accRes.rows.length === 0) return { success: false, error: 'Account not found' };
    const account = mapInrStatementAccount(accRes.rows[0] as Record<string, unknown>);

    const beforeParams: unknown[] = [params.accountId];
    let beforeSql = `
      SELECT
        COALESCE(SUM(CASE WHEN debit_account_id = $1 THEN amount ELSE 0 END), 0) AS dr,
        COALESCE(SUM(CASE WHEN credit_account_id = $1 THEN amount ELSE 0 END), 0) AS cr
      FROM inr_fund_vouchers
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
      `COALESCE(v.status, 'active') <> 'void'`,
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
    }

    const vRes = await query(
      `${INR_VOUCHER_DETAIL_SELECT_SQL}
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
        currency: 'INR',
      },
    };
  } catch (err) {
    logger.error({ err, params }, 'Failed to load INR fund statement');
    return { success: false, error: 'Failed to load INR statement' };
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
    await relinkAedAgentLedgerAccounts();
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

    if (
      (account.sourceType === 'ic_supplier' || account.sourceType === 'ic_counterparty') &&
      account.sourceId
    ) {
      const purchases = await query(
        `SELECT p.id, p.created_at, p.units, p.aed_total,
                COALESCE(p.metal_payment_method, p.payment_method) AS payment_method,
                p.settlement_mode, p.inr_total, p.lab_total_inr,
                p.split_inr_paid, p.split_aed_paid, w.name AS warehouse_name
         FROM ic_purchases p
         LEFT JOIN ic_warehouses w ON w.id = p.warehouse_id
         WHERE ${RELATED_PURCHASE_PARTY_SQL}
         ORDER BY p.created_at DESC
         LIMIT 100`,
        [account.sourceId],
      );
      detail.relatedPurchases = purchases.rows.map(row => {
        const paymentMethod = row.payment_method ? String(row.payment_method) : undefined;
        const isMetal = row.settlement_mode === 'metal';
        return {
          id: String(row.id),
          date: row.created_at ? String(row.created_at) : '',
          units: Number(row.units) || 0,
          aedAmount: isMetal
            ? bookedMetalAed({
                paymentMethod,
                aedTotal: row.aed_total,
                splitAedPaid: row.split_aed_paid,
              })
            : Number(row.aed_total) || 0,
          inrTotal:
            row.inr_total != null
              ? isMetal
                ? bookedMetalInr({
                    paymentMethod,
                    inrTotal: row.inr_total,
                    labTotalInr: row.lab_total_inr,
                    splitInrPaid: row.split_inr_paid,
                  })
                : Number(row.inr_total)
              : undefined,
          settlementMode: isMetal ? 'metal' : 'cash',
          paymentMethod,
          warehouseName: row.warehouse_name ? String(row.warehouse_name) : undefined,
        };
      }) as ICFundAccountRelatedPurchase[];

      const sales = await query(
        `SELECT s.id, s.created_at, s.units, s.aed_amount, s.order_status, s.payment_status, s.order_customer_name,
                s.settlement_mode, s.metal_payment_method, s.inr_total, s.lab_total_inr,
                s.split_inr_paid, s.split_aed_paid
         FROM ic_sales s
         WHERE ${RELATED_SALE_PARTY_SQL}
         ORDER BY s.created_at DESC
         LIMIT 100`,
        [account.sourceId],
      );
      detail.relatedSales = sales.rows.map(row => {
        const paymentMethod = row.metal_payment_method ? String(row.metal_payment_method) : undefined;
        const isMetal = row.settlement_mode === 'metal';
        return {
          id: String(row.id),
          date: row.created_at ? String(row.created_at) : '',
          units: Number(row.units) || 0,
          aedAmount: isMetal
            ? bookedMetalAed({
                paymentMethod,
                aedTotal: row.aed_amount,
                splitAedPaid: row.split_aed_paid,
              })
            : Number(row.aed_amount) || 0,
          inrTotal:
            row.inr_total != null && isMetal
              ? bookedMetalInr({
                  paymentMethod,
                  inrTotal: row.inr_total,
                  labTotalInr: row.lab_total_inr,
                  splitInrPaid: row.split_inr_paid,
                })
              : undefined,
          orderStatus: row.order_status ? String(row.order_status) : undefined,
          paymentStatus: row.payment_status ? String(row.payment_status) : undefined,
          customerName: row.order_customer_name ? String(row.order_customer_name) : undefined,
        };
      }) as ICFundAccountRelatedSale[];

      const supplier = await query(
        `SELECT cp.commission
         FROM ic_counterparties cp
         LEFT JOIN ic_aed_agents aa ON aa.counterparty_id = cp.id
         WHERE cp.id::text = $1
            OR aa.id::text = $1
            OR ('aed_agent:' || aa.id::text) = $1
         LIMIT 1`,
        [account.sourceId],
      );
      if (supplier.rows[0]) {
        detail.relatedMeta = {
          commission: Number(supplier.rows[0].commission) || 0,
        };
      }
    }

    if (account.sourceType === 'ic_warehouse' && account.sourceId) {
      const sales = await query(
        `SELECT id, created_at, units, aed_amount, order_status, payment_status, order_customer_name,
                settlement_mode, metal_payment_method, inr_total, lab_total_inr,
                split_inr_paid, split_aed_paid
         FROM ic_sales
         WHERE warehouse_id = $1
         ORDER BY created_at DESC
         LIMIT 100`,
        [account.sourceId],
      );
      detail.relatedSales = sales.rows.map(row => {
        const paymentMethod = row.metal_payment_method ? String(row.metal_payment_method) : undefined;
        const isMetal = row.settlement_mode === 'metal';
        return {
          id: String(row.id),
          date: row.created_at ? String(row.created_at) : '',
          units: Number(row.units) || 0,
          aedAmount: isMetal
            ? bookedMetalAed({
                paymentMethod,
                aedTotal: row.aed_amount,
                splitAedPaid: row.split_aed_paid,
              })
            : Number(row.aed_amount) || 0,
          inrTotal:
            row.inr_total != null && isMetal
              ? bookedMetalInr({
                  paymentMethod,
                  inrTotal: row.inr_total,
                  labTotalInr: row.lab_total_inr,
                  splitInrPaid: row.split_inr_paid,
                })
              : undefined,
          orderStatus: row.order_status ? String(row.order_status) : undefined,
          paymentStatus: row.payment_status ? String(row.payment_status) : undefined,
          customerName: row.order_customer_name ? String(row.order_customer_name) : undefined,
        };
      }) as ICFundAccountRelatedSale[];

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

export type ICFundBooksReportData = {
  accounts: ICFundAccount[];
  accountLedgers: AccountPeriodLedger[];
  cashBank: ICFundAccount[];
  allVouchers: ICFundVoucher[];
  dayBookTruncated: boolean;
  inrAllVouchers: ICFundVoucher[];
  inrDayBookTruncated: boolean;
  inrAccounts: ICFundAccount[];
  inrReceivables: ICFundAccount[];
  inrPayables: ICFundAccount[];
  dExpenses: ICFundVoucher[];
  expenseRegister: ICFundVoucher[];
  receivables: ICFundAccount[];
  payables: ICFundAccount[];
  trialBalance: ICFundTrialBalanceLine[];
  inrTrialBalance: ICFundTrialBalanceLine[];
  asOfDate: string | null;
  startDate: string | null;
  endDate: string | null;
  profitLoss: {
    income: number;
    profit: number;
    expense: number;
    dExpense: number;
    net: number;
  };
  plStatement: PlStatement;
  balanceSheet: {
    bank: number;
    receivables: number;
    payables: number;
    equity: number;
    inventoryOnHand: number;
    accumulatedPL: number;
    totalAssets: number;
    totalLiabilitiesEquity: number;
    balanced: boolean;
    outOfBalance: number;
  };
  balanceSheetDetail: BalanceSheetPresentation;
  voucherRangeStats?: ICFundVoucherRangeStats;
};

function emptyBooksReportShell(
  startDate: string | null,
  endDate: string | null,
): ICFundBooksReportData {
  const asOfDate = endDate;
  const zeroPl = { income: 0, profit: 0, expense: 0, dExpense: 0, net: 0 };
  return {
    accounts: [],
    accountLedgers: [],
    cashBank: [],
    allVouchers: [],
    dayBookTruncated: false,
    inrAllVouchers: [],
    inrDayBookTruncated: false,
    inrAccounts: [],
    inrReceivables: [],
    inrPayables: [],
    dExpenses: [],
    expenseRegister: [],
    receivables: [],
    payables: [],
    trialBalance: [],
    inrTrialBalance: [],
    asOfDate,
    startDate,
    endDate,
    profitLoss: zeroPl,
    plStatement: buildPlStatement([], [], zeroPl),
    balanceSheet: {
      bank: 0,
      receivables: 0,
      payables: 0,
      equity: 0,
      inventoryOnHand: 0,
      accumulatedPL: 0,
      totalAssets: 0,
      totalLiabilitiesEquity: 0,
      balanced: true,
      outOfBalance: 0,
    },
    balanceSheetDetail: buildBalanceSheetPresentation([], 0, new Map()),
  };
}

async function mergeAccountsWithPeriodLedgers(
  branchId: string,
  asOfDate: string | null,
  accountLedgers: AccountPeriodLedger[],
): Promise<ICFundAccount[]> {
  const fullAccounts = await fetchAccountsWithBalances(branchId, asOfDate);
  const ledgerById = new Map(accountLedgers.map(l => [l.accountId, l]));
  return fullAccounts.map(a => {
    const ledger = ledgerById.get(a.id);
    if (!ledger) return a;
    return {
      ...a,
      balance: ledger.closing,
      pendingBalance: ledger.pendingBalance,
    };
  });
}

/** Loads only the data each books report view needs (no monolithic voucher dump). */
export async function getICFundBooksReportAction(
  params: unknown,
): Promise<ActionResult<ICFundBooksReportData>> {
  const parsed = icFundsBooksReportSchema.safeParse(params);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const access = await requireICFundsAccess(parsed.data.branchId, 'read');
  if (!access.ok) return { success: false, error: access.error };

  const branchId = parsed.data.branchId;
  const startDate = parsed.data.startDate ?? null;
  const endDate = parsed.data.endDate ?? null;
  const asOfDate = endDate;
  const ledgerBook = parsed.data.ledgerBook === 'INR' ? 'INR' : 'AED';
  const view = parsed.data.reportView;

  try {
    const shell = emptyBooksReportShell(startDate, endDate);

    switch (view) {
      case 'receivables': {
        const [aedAccounts, inrAccounts] = await Promise.all([
          fetchAccountsWithBalances(branchId, asOfDate),
          fetchInrAccountsWithBalances(asOfDate),
        ]);
        const aedSplit = splitTradeReceivablesPayables(aedAccounts);
        const inrSplit = splitTradeReceivablesPayables(inrAccounts);
        return {
          success: true,
          data: {
            ...shell,
            accounts: aedAccounts,
            inrAccounts,
            receivables: aedSplit.receivables,
            payables: aedSplit.payables,
            inrReceivables: inrSplit.receivables,
            inrPayables: inrSplit.payables,
          },
        };
      }
      case 'all-vouchers': {
        const [bookVouchers, stats] = await Promise.all([
          queryReportVouchers({ branchId, startDate: startDate ?? undefined, endDate: endDate ?? undefined, book: ledgerBook }),
          queryVoucherRangeStatsForBook(branchId, {
            startDate: startDate ?? undefined,
            endDate: endDate ?? undefined,
            book: ledgerBook,
          }),
        ]);
        const inrAccounts =
          ledgerBook === 'INR'
            ? await fetchInrAccountsWithBalances(asOfDate)
            : shell.inrAccounts;
        const patch =
          ledgerBook === 'INR'
            ? {
                inrAllVouchers: bookVouchers.vouchers,
                inrDayBookTruncated: bookVouchers.truncated,
                inrAccounts,
              }
            : {
                allVouchers: bookVouchers.vouchers,
                dayBookTruncated: bookVouchers.truncated,
              };
        return {
          success: true,
          data: { ...shell, ...patch, voucherRangeStats: stats },
        };
      }
      case 'd-expenses': {
        const expenseVouchers = await queryReportVouchers({
          branchId,
          startDate: startDate ?? undefined,
          endDate: endDate ?? undefined,
          book: 'AED',
          expenseOnly: true,
        });
        const stats = await queryVoucherRangeStatsForBook(branchId, {
          startDate: startDate ?? undefined,
          endDate: endDate ?? undefined,
          book: 'AED',
          expenseOnly: true,
        });
        return {
          success: true,
          data: {
            ...shell,
            dExpenses: expenseVouchers.vouchers.filter(
              v => v.debitAccountType === 'd_expense' || v.creditAccountType === 'd_expense',
            ),
            expenseRegister: expenseVouchers.vouchers,
            voucherRangeStats: stats,
          },
        };
      }
      case 'cash-bank': {
        const accountLedgers = await fetchAccountPeriodLedgers(branchId, startDate, endDate);
        const accounts = await mergeAccountsWithPeriodLedgers(branchId, asOfDate, accountLedgers);
        return {
          success: true,
          data: {
            ...shell,
            accounts,
            accountLedgers,
            cashBank: accounts.filter(a => a.accountType === 'bank'),
          },
        };
      }
      case 'trial-balance': {
        const [accountLedgers, inrAccountLedgers, inrAccounts] = await Promise.all([
          fetchAccountPeriodLedgers(branchId, startDate, endDate),
          fetchInrAccountPeriodLedgers(HQ_IC_FUNDS_BRANCH_ID, startDate, endDate),
          fetchInrAccountsWithBalances(asOfDate),
        ]);
        const accounts = await mergeAccountsWithPeriodLedgers(branchId, asOfDate, accountLedgers);
        return {
          success: true,
          data: {
            ...shell,
            accounts,
            accountLedgers,
            inrAccounts,
            trialBalance: buildTrialBalanceLines(accountLedgers),
            inrTrialBalance: buildTrialBalanceLines(inrAccountLedgers),
          },
        };
      }
      case 'balance-sheet': {
        const accountLedgers = await fetchAccountPeriodLedgers(branchId, startDate, endDate);
        const accounts = await mergeAccountsWithPeriodLedgers(branchId, asOfDate, accountLedgers);
        const periodPL = await queryProfitLossTotals(branchId, {
          startDate: startDate ?? undefined,
          endDate: endDate ?? undefined,
        });
        const plStatement = buildPlStatement(accountLedgers, [], periodPL);
        const accountById = new Map(accounts.map(a => [a.id, a] as const));
        const balanceSheetDetail = buildBalanceSheetPresentation(
          accountLedgers,
          plStatement.netForPeriod,
          accountById,
        );
        const accumulatedTotals = asOfDate
          ? await queryProfitLossTotals(branchId, { endDate: asOfDate })
          : periodPL;
        const accumulatedPL =
          accumulatedTotals.income +
          accumulatedTotals.profit -
          accumulatedTotals.expense -
          accumulatedTotals.dExpense;
        const cashBank = accounts.filter(a => a.accountType === 'bank');
        const { receivables, payables } = splitTradeReceivablesPayables(accounts);
        const bankTotal = balanceSheetDetail.assets
          .filter(l => l.accountId && cashBank.some(c => c.id === l.accountId))
          .reduce((s, l) => s + l.amount, 0);
        const ar = receivables.reduce((s, a) => s + Math.max(0, a.balance), 0);
        const ap = payables.reduce((s, a) => s + Math.abs(Math.min(0, a.balance)), 0);
        const profitReserve = accountLedgers
          .filter(a => a.accountType === 'profit')
          .reduce((s, a) => s + -a.closing, 0);
        const inventoryOnHand = accounts
          .filter(
            a => a.sourceId === 'ic_inventory' || a.name.trim() === 'IC Stock' || a.name.trim() === 'IC Inventory',
          )
          .reduce((sum, a) => sum + Math.max(0, a.balance), 0);
        const { income, profit, expense, dExpense } = periodPL;
        const aedTbTotals = summarizeTrialBalanceTotals(accountLedgers);
        const tbBalanced = trialBalanceColumnsBalanced(aedTbTotals.closingDebit, aedTbTotals.closingCredit);

        return {
          success: true,
          data: {
            ...shell,
            accounts,
            accountLedgers,
            cashBank,
            receivables,
            payables,
            plStatement,
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
              inventoryOnHand: Number(inventoryOnHand.toFixed(2)),
              accumulatedPL: Number(accumulatedPL.toFixed(2)),
              totalAssets: balanceSheetDetail.totalAssets,
              totalLiabilitiesEquity: balanceSheetDetail.totalLiabilitiesEquity,
              balanced: balanceSheetDetail.balanced && tbBalanced,
              outOfBalance: balanceSheetDetail.outOfBalance,
            },
            balanceSheetDetail,
          },
        };
      }
    }
  } catch (err) {
    logger.error({ err, view }, 'Failed to load IC fund books report');
    return { success: false, error: 'Failed to load reports' };
  }
}

/** @deprecated Use getICFundBooksReportAction with reportView. */
export async function getICFundReportBundleAction(params: unknown): Promise<ActionResult<ICFundBooksReportData>> {
  const base = icFundsDateRangeSchema.safeParse(params);
  if (!base.success) return { success: false, error: base.error.issues[0]?.message ?? 'Invalid input' };
  return getICFundBooksReportAction({ ...base.data, reportView: 'trial-balance' });
}

export async function getICFundPlLedgerScreenAction(params: unknown): Promise<
  ActionResult<{
    accounts: ICFundAccount[];
    accountLedgers: AccountPeriodLedger[];
    profitLoss: ICFundBooksReportData['profitLoss'];
    plVouchers: ICFundVoucher[];
    plVouchersTruncated: boolean;
  }>
> {
  const parsed = icFundsDateRangeSchema.safeParse(params);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const access = await requireICFundsAccess(parsed.data.branchId, 'read');
  if (!access.ok) return { success: false, error: access.error };

  const startDate = parsed.data.startDate ?? null;
  const endDate = parsed.data.endDate ?? null;
  try {
    const [accountLedgers, periodPL, plVouchers] = await Promise.all([
      fetchAccountPeriodLedgers(parsed.data.branchId, startDate, endDate),
      queryProfitLossTotals(parsed.data.branchId, {
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
      }),
      queryReportVouchers({
        branchId: parsed.data.branchId,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        book: 'AED',
        plOnly: true,
      }),
    ]);
    const accounts = await mergeAccountsWithPeriodLedgers(parsed.data.branchId, endDate, accountLedgers);
    const { income, profit, expense, dExpense } = periodPL;
    return {
      success: true,
      data: {
        accounts,
        accountLedgers,
        plVouchers: plVouchers.vouchers,
        plVouchersTruncated: plVouchers.truncated,
        profitLoss: {
          income: Number(income.toFixed(2)),
          profit: Number(profit.toFixed(2)),
          expense: Number(expense.toFixed(2)),
          dExpense: Number(dExpense.toFixed(2)),
          net: Number((income + profit - expense - dExpense).toFixed(2)),
        },
      },
    };
  } catch (err) {
    logger.error({ err }, 'Failed to load P&L ledger screen');
    return { success: false, error: 'Failed to load profit & loss.' };
  }
}

/** Lightweight P&L tab: ledger P&L + period metal INR KPIs only (no full report bundle). */
export async function getICFundProfitLossReportAction(
  params: unknown,
): Promise<ActionResult<ICFundProfitLossReport>> {
  const parsed = icFundProfitLossReportSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const access = await requireICFundsAccess(parsed.data.branchId, 'read');
  if (!access.ok) return { success: false, error: access.error };

  const startDate = parsed.data.startDate ?? null;
  const endDate = parsed.data.endDate ?? null;

  try {
    const tzRes = await query(`SELECT timezone FROM branches WHERE id = $1 LIMIT 1`, [
      parsed.data.branchId,
    ]);
    const branchTimeZone = resolveBranchTimeZone(
      tzRes.rows[0]?.timezone != null ? String(tzRes.rows[0].timezone) : null,
    );

    const [metalPl, warehousePl] = await Promise.all([
      queryMetalPlPeriodKpis({
        branchId: parsed.data.branchId,
        startDate,
        endDate,
        warehouseId: parsed.data.warehouseId,
        branchTimeZone,
      }),
      getICWarehousePLReportAction({
        branchId: parsed.data.branchId,
        startDate: startDate ?? undefined,
        endDate: endDate ?? undefined,
      }),
    ]);

    if (!warehousePl.success) {
      return { success: false, error: warehousePl.error };
    }
    const selectedWarehouses = parsed.data.warehouseId
      ? warehousePl.data.warehouses.filter(w => w.warehouseId === parsed.data.warehouseId)
      : warehousePl.data.warehouses;
    const icProfit = {
      revenue: Number(selectedWarehouses.reduce((s, w) => s + w.revenue, 0).toFixed(2)),
      cogs: Number(selectedWarehouses.reduce((s, w) => s + w.cogs, 0).toFixed(2)),
      grossProfit: Number(selectedWarehouses.reduce((s, w) => s + w.grossProfit, 0).toFixed(2)),
    };
    // This report's AED result is the warehouse IC margin, not ledger journal movement.
    const plStatement = buildPlStatement([], [], {
      income: icProfit.revenue,
      profit: 0,
      expense: 0,
      dExpense: icProfit.cogs,
    });

    return {
      success: true,
      data: {
        plStatement,
        profitLoss: {
          income: icProfit.revenue,
          profit: 0,
          expense: 0,
          dExpense: icProfit.cogs,
          net: icProfit.grossProfit,
        },
        metalPl,
        icProfit,
        startDate,
        endDate,
      },
    };
  } catch (err) {
    logger.error({ err }, 'Failed to load profit & loss report');
    return { success: false, error: 'Failed to load profit & loss' };
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
    const endSql = endDate
      ? isHqLedger
        ? `AND p.created_at < ($1::date + interval '1 day')`
        : `AND p.created_at < ($2::date + interval '1 day')`
      : '';
    const endSaleSql = endDate
      ? isHqLedger
        ? `AND s.created_at < ($1::date + interval '1 day')`
        : `AND s.created_at < ($2::date + interval '1 day')`
      : '';
    const branchParams = isHqLedger
      ? endDate
        ? [endDate]
        : []
      : endDate
        ? [branchId, endDate]
        : [branchId];

    const purchasesQuery = query(
      `SELECT
         p.warehouse_id,
         p.id,
         p.units,
         p.unit_rate,
         p.aed_total,
         p.inr_total,
         p.lab_total_inr,
         p.split_aed_paid,
         p.settlement_mode,
         p.metal_weight_g,
         p.metal_rate_aed_per_g,
         p.metal_payment_method,
         p.created_at,
         w.name AS warehouse_name,
         cp.name AS supplier_name
       FROM ic_purchases p
       JOIN ic_warehouses w ON w.id = p.warehouse_id
       LEFT JOIN ic_counterparties cp ON cp.id = p.counterparty_id
       WHERE p.warehouse_id IS NOT NULL ${branchFilter} ${endSql}
       ORDER BY p.created_at ASC, p.id ASC`,
      branchParams,
    );

    const salesQuery = query(
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
         s.settlement_mode,
         s.inr_total,
         s.lab_total_inr,
         s.metal_weight_g,
         s.metal_purchase_id,
         s.metal_payment_method,
         s.split_aed_paid,
         COALESCE(s.status_updated_at, s.created_at) AS sale_at,
         w.name AS warehouse_name
       FROM ic_sales s
       JOIN ic_warehouses w ON w.id = s.warehouse_id
       WHERE s.warehouse_id IS NOT NULL
         AND COALESCE(s.order_status, 'completed') NOT IN (
           'branch_rejected', 'admin_rejected', 'wh_rejected', 'da_rejected',
           'cancelled', 'cancellation_pending'
         )
         ${branchFilter} ${endSaleSql}
       ORDER BY sale_at ASC, s.created_at ASC, s.id ASC`,
      branchParams,
    );

    const warehousesQuery = query(
      `SELECT w.id, w.name, w.opening_stock, w.opening_aed
       FROM ic_warehouses w
       WHERE true ${branchFilter}`,
      isHqLedger ? [] : [branchId],
    );

    const [purchasesRes, allSalesRes, warehousesRes] = await Promise.all([
      purchasesQuery,
      salesQuery,
      warehousesQuery,
    ]);

    const warehouseMeta = new Map<string, string>();
    const warehouseOpening = new Map<string, { units: number; aed: number }>();
    for (const row of warehousesRes.rows) {
      const id = String(row.id);
      warehouseMeta.set(id, String(row.name ?? 'Warehouse'));
      warehouseOpening.set(id, {
        units: Number(row.opening_stock) || 0,
        aed: Number(row.opening_aed) || 0,
      });
    }
    const purchasesByWarehouse = new Map<string, ICPurchase[]>();
    const salesByWarehouseForIc = new Map<string, ICSale[]>();
    const salesByWarehouse = new Map<
      string,
      Array<{
        id: string;
        saleAt: Date;
        customerName: string;
        warehouseName: string;
        settlementMode: 'cash' | 'metal';
      }>
    >();
    const metalEventsByWarehouse = new Map<string, MetalWeightEvent[]>();
    const metalLots = new Map<
      string,
      { inrTotal: number; aedTotal: number; splitAedPaid: number; metalWeightG: number; metalRateAedPerG: number; paymentMethod: string | null; labTotalInr: number }
    >();
    const metalSalesByWarehouse = new Map<
      string,
      Array<{
        id: string;
        saleAt: Date;
        customerName: string;
        warehouseName: string;
        warehouseId: string;
        saleG: number;
        saleInr: number;
        saleAed: number;
        splitAedPaid: number;
        lotId: string | null;
        paymentMethod: 'INR' | 'AED' | 'SPLIT';
      }>
    >();

    const lines: ICWarehousePLReport['lines'] = [];

    for (const row of purchasesRes.rows) {
      const warehouseId = String(row.warehouse_id);
      warehouseMeta.set(warehouseId, String(row.warehouse_name ?? 'Warehouse'));
      if (row.settlement_mode === 'metal') {
        const purchaseId = String(row.id);
        metalLots.set(purchaseId, {
          inrTotal: Number(row.inr_total) || 0,
          aedTotal: Number(row.aed_total) || 0,
          splitAedPaid: Number(row.split_aed_paid) || 0,
          metalWeightG: Number(row.metal_weight_g) || 0,
          metalRateAedPerG: Number(row.metal_rate_aed_per_g) || 0,
          paymentMethod: row.metal_payment_method ? String(row.metal_payment_method) : null,
          labTotalInr: Number(row.lab_total_inr) || 0,
        });
        const createdAt = new Date(String(row.created_at));
        const purchaseMs = createdAt.getTime();
        const metalWg = Number(row.metal_weight_g) || 0;
        const isAedPur = isMetalAedPayment(row.metal_payment_method);
        const purchaseInrForLine = allocateMetalLotCostInr(
          {
            inrTotal: Number(row.inr_total) || 0,
            metalWeightG: metalWg,
            labTotalInr: Number(row.lab_total_inr) || 0,
          },
          metalWg,
        );
        const purchaseAedForLine = allocateMetalLotCostAed(
          { aedTotal: Number(row.aed_total) || 0, metalWeightG: metalWg },
          metalWg,
        );
        const inPeriod =
          (periodStartMs == null || purchaseMs >= periodStartMs) &&
          (periodEndMs == null || purchaseMs <= periodEndMs);
        if (inPeriod) {
          lines.push({
            lineKind: 'metal_purchase',
            saleId: purchaseId,
            eventAtMs: purchaseMs,
            saleDate: isoDate(createdAt),
            warehouseId,
            warehouseName: String(row.warehouse_name ?? 'Warehouse'),
            customerName: String(row.supplier_name ?? 'Supplier'),
            units: metalWg,
            saleRate: 0,
            revenue: 0,
            avgPurchaseRate: 0,
            cogs: isAedPur ? purchaseAedForLine : purchaseInrForLine,
            grossProfit: 0,
            marginPct: 0,
            settlementMode: 'metal',
            metalWeightG: metalWg,
            bookedCurrency: isAedPur ? 'AED' : 'INR',
            referenceId: purchaseId,
            metalDisplayRevenueInr: 0,
            metalDisplayCostInr: purchaseInrForLine,
            metalDisplayProfitInr: 0,
          });
        }
        const metalEv = metalEventsByWarehouse.get(warehouseId) ?? [];
        metalEv.push({
          at: purchaseMs,
          grams: metalWg,
        });
        metalEventsByWarehouse.set(warehouseId, metalEv);
        continue;
      }
      const units = Number(row.units) || 0;
      const purchaseMs = new Date(String(row.created_at)).getTime();
      const purchaseCost = purchaseAedTotal(units, Number(row.unit_rate) || 0, row.aed_total);
      const createdAtIso = new Date(purchaseMs).toISOString();
      const purchaseList = purchasesByWarehouse.get(warehouseId) ?? [];
      purchaseList.push({
        id: String(row.id),
        warehouseId,
        units,
        unitRate: Number(row.unit_rate) || 0,
        aedTotal: purchaseCost,
        settlementMode: 'cash',
        createdAt: createdAtIso,
      });
      purchasesByWarehouse.set(warehouseId, purchaseList);

      const inPeriod =
        (periodStartMs == null || purchaseMs >= periodStartMs) &&
        (periodEndMs == null || purchaseMs <= periodEndMs);
      if (inPeriod && units > 0) {
        const purchaseId = String(row.id);
        lines.push({
          lineKind: 'ic_purchase',
          saleId: purchaseId,
          eventAtMs: purchaseMs,
          saleDate: isoDate(new Date(purchaseMs)),
          warehouseId,
          warehouseName: String(row.warehouse_name ?? 'Warehouse'),
          customerName: String(row.supplier_name ?? 'Supplier'),
          units,
          saleRate: Number(row.unit_rate) || 0,
          revenue: 0,
          avgPurchaseRate: 0,
          cogs: purchaseCost,
          grossProfit: 0,
          marginPct: 0,
          settlementMode: 'cash',
          referenceId: purchaseId,
        });
      }
    }

    for (const row of allSalesRes.rows) {
      const warehouseId = String(row.warehouse_id);
      warehouseMeta.set(warehouseId, String(row.warehouse_name ?? 'Warehouse'));
      const saleAt = new Date(String(row.sale_at));
      const settlementMode = row.settlement_mode === 'metal' ? 'metal' : 'cash';

      if (settlementMode === 'metal') {
        const metalEv = metalEventsByWarehouse.get(warehouseId) ?? [];
        metalEv.push({ at: saleAt.getTime(), grams: -(Number(row.metal_weight_g) || 0) });
        metalEventsByWarehouse.set(warehouseId, metalEv);
        const metalSaleList = salesByWarehouseForIc.get(warehouseId) ?? [];
        metalSaleList.push({
          id: String(row.id),
          customerName: String(row.order_customer_name || row.customer_name || 'Customer'),
          warehouseId,
          units: Number(row.units) || 0,
          unitRate: Number(row.unit_rate) || 0,
          aedAmount: Number(row.aed_amount) || 0,
          serviceCharge: Number(row.service_charge) || 0,
          collectedUnits: row.collected_units != null ? Number(row.collected_units) : undefined,
          settlementMode: 'metal',
          metalPaymentMethod: normalizeMetalPaymentMethod(row.metal_payment_method),
          metalWeightG: Number(row.metal_weight_g) || 0,
          metalPurchaseId: row.metal_purchase_id ? String(row.metal_purchase_id) : null,
          orderStatus: 'completed',
          createdAt: new Date(String(row.created_at)).toISOString(),
          statusUpdatedAt: saleAt.toISOString(),
        });
        salesByWarehouseForIc.set(warehouseId, metalSaleList);
        const metalSales = metalSalesByWarehouse.get(warehouseId) ?? [];
        metalSales.push({
          id: String(row.id),
          saleAt,
          customerName: String(row.order_customer_name || row.customer_name || 'Customer'),
          warehouseName: String(row.warehouse_name ?? 'Warehouse'),
          warehouseId,
          saleG: Number(row.metal_weight_g) || 0,
          saleInr: netMetalInr(Number(row.inr_total) || 0, Number(row.lab_total_inr) || 0),
          saleAed: (Number(row.aed_amount) || 0) + (Number(row.service_charge) || 0),
          splitAedPaid: Number(row.split_aed_paid) || 0,
          lotId: row.metal_purchase_id ? String(row.metal_purchase_id) : null,
          paymentMethod:
            tradeLinePaymentFromDb(row.metal_payment_method) === 'SPLIT'
              ? 'SPLIT'
              : normalizeMetalPaymentMethod(row.metal_payment_method) === 'AED'
                ? 'AED'
                : 'INR',
        });
        metalSalesByWarehouse.set(warehouseId, metalSales);
        continue;
      }

      const cashSaleList = salesByWarehouseForIc.get(warehouseId) ?? [];
      cashSaleList.push({
        id: String(row.id),
        customerName: String(row.order_customer_name || row.customer_name || 'Customer'),
        warehouseId,
        units: Number(row.units) || 0,
        unitRate: Number(row.unit_rate) || 0,
        aedAmount: Number(row.aed_amount) || 0,
        serviceCharge: Number(row.service_charge) || 0,
        collectedUnits: row.collected_units != null ? Number(row.collected_units) : undefined,
        settlementMode: 'cash',
        orderStatus: 'completed',
        createdAt: new Date(String(row.created_at)).toISOString(),
        statusUpdatedAt: saleAt.toISOString(),
      });
      salesByWarehouseForIc.set(warehouseId, cashSaleList);

      const sales = salesByWarehouse.get(warehouseId) ?? [];
      sales.push({
        id: String(row.id),
        saleAt,
        customerName: String(row.order_customer_name || row.customer_name || 'Customer'),
        warehouseName: String(row.warehouse_name ?? 'Warehouse'),
        settlementMode: 'cash',
      });
      salesByWarehouse.set(warehouseId, sales);
    }

    const warehouseSummaries = new Map<
      string,
      {
        warehouseName: string;
        openingUnits: number;
        unitsIn: number;
        unitsOut: number;
        closingUnits: number;
        openingMetalG: number;
        metalInG: number;
        metalOutG: number;
        closingMetalG: number;
        purchaseUnits: number;
        purchaseCost: number;
        weightedAvgRate: number;
        saleUnits: number;
        revenue: number;
        cogs: number;
        grossProfit: number;
        metalProfitAed: number;
        metalProfitInr: number;
        metalSoldG: number;
      }
    >();

    const emptyMetal = { metalProfitAed: 0, metalProfitInr: 0, metalSoldG: 0 };

    function icEventsForWarehouse(warehouseId: string): WarehouseInventoryEvent[] {
      const purchases = purchasesByWarehouse.get(warehouseId) ?? [];
      const sales = (salesByWarehouseForIc.get(warehouseId) ?? []).filter(isDealSaleActive);
      const opening = warehouseOpening.get(warehouseId);
      return buildIcStockInventoryEvents(purchases, sales, undefined, opening);
    }

    function movementForWarehouse(warehouseId: string) {
      const icEvents = icEventsForWarehouse(warehouseId);
      const metalEv = metalEventsByWarehouse.get(warehouseId) ?? [];
      const openingUnits = icUnitStockAt(icEvents, periodStartMs);
      const closingUnits = icUnitStockThrough(icEvents, periodEndMs);
      const { unitsIn, unitsOut } = sumIcUnitsInPeriod(icEvents, periodStartMs, periodEndMs);
      const openingMetalG = metalStockAt(metalEv, periodStartMs);
      const closingMetalG = metalStockThrough(metalEv, periodEndMs);
      const { metalInG, metalOutG } = metalMovementInPeriod(metalEv, periodStartMs, periodEndMs);
      return {
        openingUnits: Number(openingUnits.toFixed(8)),
        unitsIn: Number(unitsIn.toFixed(8)),
        unitsOut: Number(unitsOut.toFixed(8)),
        closingUnits: Number(closingUnits.toFixed(8)),
        openingMetalG: Number(openingMetalG.toFixed(4)),
        metalInG: Number(metalInG.toFixed(4)),
        metalOutG: Number(metalOutG.toFixed(4)),
        closingMetalG: Number(closingMetalG.toFixed(4)),
      };
    }

    const icWarehouseIds = new Set<string>([
      ...warehouseMeta.keys(),
      ...purchasesByWarehouse.keys(),
      ...salesByWarehouseForIc.keys(),
    ]);

    for (const warehouseId of icWarehouseIds) {
      const cutoffMs = periodEndMs ?? Number.POSITIVE_INFINITY;
      const eventsThroughPeriod = icEventsForWarehouse(warehouseId).filter(e => e.at <= cutoffMs);
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
          lineKind: 'sale',
          saleId: sale.id,
          eventAtMs: saleMs,
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
          settlementMode: 'cash',
          referenceId: sale.id,
        });

        periodSaleUnits += margin.deliveredUnits;
        periodRevenue += margin.revenue;
        periodCogs += margin.cogs;
        periodGrossProfit += margin.grossProfit;
      }

      warehouseSummaries.set(warehouseId, {
        warehouseName,
        purchaseUnits: Number(pool.units.toFixed(8)),
        purchaseCost: Number(pool.cost.toFixed(2)),
        weightedAvgRate: Number(remainingStockWac(pool).toFixed(2)),
        saleUnits: Number(periodSaleUnits.toFixed(8)),
        revenue: Number(periodRevenue.toFixed(2)),
        cogs: Number(periodCogs.toFixed(2)),
        grossProfit: Number(periodGrossProfit.toFixed(2)),
        ...emptyMetal,
        ...movementForWarehouse(warehouseId),
      });
    }

    for (const [warehouseId, metalSales] of metalSalesByWarehouse) {
      const existing = warehouseSummaries.get(warehouseId) ?? {
        warehouseName: warehouseMeta.get(warehouseId) ?? 'Warehouse',
        purchaseUnits: 0,
        purchaseCost: 0,
        weightedAvgRate: 0,
        saleUnits: 0,
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        ...emptyMetal,
      };
      let metalProfitAed = 0;
      let metalProfitInr = 0;
      let metalSoldG = 0;

      for (const sale of metalSales) {
        const saleMs = sale.saleAt.getTime();
        if (periodStartMs != null && saleMs < periodStartMs) continue;
        if (periodEndMs != null && saleMs > periodEndMs) continue;
        const lot = sale.lotId ? metalLots.get(sale.lotId) : undefined;
        const salePay =
          sale.paymentMethod === 'AED'
            ? 'AED'
            : sale.paymentMethod === 'SPLIT'
              ? 'SPLIT'
              : 'CASH';
        const pl = computeMetalLotProfit({
          paymentMethod: salePay,
          purchasePaymentMethod: lot?.paymentMethod ?? undefined,
          weightG: sale.saleG,
          purchaseInr: lot
            ? allocateMetalLotCostInr(
                { inrTotal: lot.inrTotal, metalWeightG: lot.metalWeightG, labTotalInr: lot.labTotalInr },
                sale.saleG,
              )
            : 0,
          purchaseAed: lot
          ? allocateMetalLotBookedCostAed(
              { aedTotal: lot.aedTotal, splitAedPaid: lot.splitAedPaid, paymentMethod: lot.paymentMethod, metalWeightG: lot.metalWeightG, metalRateAedPerG: lot.metalRateAedPerG },
                sale.saleG,
              )
            : 0,
          saleInr: sale.saleInr,
          saleAed: sale.saleAed,
          saleSplitAedPaid: sale.splitAedPaid,
        });
        metalProfitAed += Number(pl.bookedProfitAed) || 0;
        metalProfitInr += Number(pl.bookedProfitInr) || 0;
        metalSoldG += sale.saleG;
        const isAedMetal = sale.paymentMethod === 'AED';
        lines.push({
          lineKind: 'sale',
          saleId: sale.id,
          eventAtMs: saleMs,
          saleDate: isoDate(sale.saleAt),
          warehouseId,
          warehouseName: sale.warehouseName,
          customerName: sale.customerName,
          units: sale.saleG,
          saleRate: 0,
          revenue: isAedMetal ? sale.saleAed : sale.saleInr,
          avgPurchaseRate: 0,
          cogs: isAedMetal ? pl.purchaseAed : pl.purchaseInr,
          grossProfit: isAedMetal ? pl.bookedProfitAed : pl.bookedProfitInr,
          marginPct: 0,
          settlementMode: 'metal',
          metalWeightG: sale.saleG,
          bookedCurrency: isAedMetal ? 'AED' : 'INR',
          referenceId: sale.id,
          metalDisplayRevenueInr: pl.saleInr,
          metalDisplayCostInr: pl.purchaseInr,
          metalDisplayProfitInr: pl.profitInr,
          metalDisplayProfitAed: pl.fxProfitAed,
        });
      }

      warehouseSummaries.set(warehouseId, {
        ...existing,
        metalProfitAed: Number(metalProfitAed.toFixed(2)),
        metalProfitInr: Number(metalProfitInr.toFixed(2)),
        metalSoldG: Number(metalSoldG.toFixed(4)),
        ...movementForWarehouse(warehouseId),
      });
    }

    for (const warehouseId of warehouseMeta.keys()) {
      if (warehouseSummaries.has(warehouseId)) continue;
      warehouseSummaries.set(warehouseId, {
        warehouseName: warehouseMeta.get(warehouseId) ?? 'Warehouse',
        purchaseUnits: 0,
        purchaseCost: 0,
        weightedAvgRate: 0,
        saleUnits: 0,
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        ...emptyMetal,
        ...movementForWarehouse(warehouseId),
      });
    }

    lines.sort(
      (a, b) =>
        a.saleDate.localeCompare(b.saleDate) ||
        a.eventAtMs - b.eventAtMs ||
        a.lineKind.localeCompare(b.lineKind) ||
        a.saleId.localeCompare(b.saleId),
    );

    const warehouses = [...warehouseSummaries.entries()]
      .map(([warehouseId, summary]) => ({
        warehouseId,
        warehouseName: summary.warehouseName,
        openingUnits: summary.openingUnits,
        unitsIn: summary.unitsIn,
        unitsOut: summary.unitsOut,
        closingUnits: summary.closingUnits,
        openingMetalG: summary.openingMetalG,
        metalInG: summary.metalInG,
        metalOutG: summary.metalOutG,
        closingMetalG: summary.closingMetalG,
        purchaseUnits: summary.purchaseUnits,
        purchaseCost: summary.purchaseCost,
        weightedAvgRate: summary.weightedAvgRate,
        saleUnits: summary.saleUnits,
        revenue: summary.revenue,
        cogs: summary.cogs,
        grossProfit: summary.grossProfit,
        metalProfitAed: summary.metalProfitAed,
        metalProfitInr: summary.metalProfitInr,
        metalSoldG: summary.metalSoldG,
      }))
      .filter(
        w =>
          w.saleUnits > 0 ||
          w.revenue > 0 ||
          w.purchaseUnits > 0 ||
          w.purchaseCost > 0 ||
          w.metalSoldG > 0 ||
          w.unitsIn > 0 ||
          w.unitsOut > 0 ||
          w.metalInG > 0 ||
          w.metalOutG > 0 ||
          Math.abs(w.openingUnits) > 0.0001 ||
          Math.abs(w.closingUnits) > 0.0001 ||
          Math.abs(w.metalProfitAed) > 0.005 ||
          Math.abs(w.metalProfitInr) > 0.005,
      )
      .sort((a, b) => a.warehouseName.localeCompare(b.warehouseName));

    const cashLines = lines.filter(l => l.settlementMode !== 'metal');
    const icSaleLines = cashLines.filter(l => l.lineKind === 'sale');
    const totals = {
      saleUnits: Number(icSaleLines.reduce((s, l) => s + l.units, 0).toFixed(4)),
      revenue: Number(icSaleLines.reduce((s, l) => s + l.revenue, 0).toFixed(2)),
      cogs: Number(icSaleLines.reduce((s, l) => s + l.cogs, 0).toFixed(2)),
      grossProfit: Number(icSaleLines.reduce((s, l) => s + l.grossProfit, 0).toFixed(2)),
      metalProfitAed: Number(warehouses.reduce((s, w) => s + w.metalProfitAed, 0).toFixed(2)),
      metalProfitInr: Number(warehouses.reduce((s, w) => s + w.metalProfitInr, 0).toFixed(2)),
      metalSoldG: Number(warehouses.reduce((s, w) => s + w.metalSoldG, 0).toFixed(4)),
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

function buildTradeDateFilter(
  startDate: string | undefined,
  endDate: string | undefined,
  paramOffset: number,
): { sql: string; params: string[]; nextIndex: number } {
  const params: string[] = [];
  let sql = '';
  let idx = paramOffset;
  if (startDate) {
    sql += ` AND t.created_at >= $${idx}::timestamptz`;
    params.push(`${startDate}T00:00:00.000Z`);
    idx += 1;
  }
  if (endDate) {
    sql += ` AND t.created_at <= $${idx}::timestamptz`;
    params.push(`${endDate}T23:59:59.999Z`);
    idx += 1;
  }
  return { sql, params, nextIndex: idx };
}

export async function getICSettlementTradeReportAction(params: unknown): Promise<
  ActionResult<ICSettlementTradeReport>
> {
  const parsed = icSettlementTradeReportSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const access = await requireICFundsAccess(parsed.data.branchId, 'read');
  if (!access.ok) return { success: false, error: access.error };

  const { branchId, startDate, endDate, settlementMode, includeVoidOrders } = parsed.data;
  const isHqLedger = isHqIcFundsBranchId(branchId);
  const branchFilter = isHqLedger ? '' : `AND (w.branch_id = $1 OR w.branch_id IS NULL)`;
  const branchParams: string[] = isHqLedger ? [] : [branchId];

  try {
    const purchaseDate = buildTradeDateFilter(startDate, endDate, branchParams.length + 1);
    const purchaseModeIndex = branchParams.length + 1 + purchaseDate.params.length;
    const purchaseRes = await query(
      `SELECT
         p.id,
         p.created_at,
         p.units,
         p.unit_rate,
         p.aed_total,
         p.inr_total,
         p.lab_total_inr,
         p.metal_weight_g,
         p.metal_rate_inr_per_g,
         p.metal_rate_aed_per_g,
         p.payment_method,
         p.metal_payment_method,
         p.split_inr_paid,
         p.split_aed_paid,
         p.payment_status,
         p.notes,
         s.name AS supplier_name,
         s.code AS supplier_code,
         s.id AS counterparty_id,
         w.id AS warehouse_id,
         w.name AS warehouse_name,
         w.code AS warehouse_code
       FROM ic_purchases p
       LEFT JOIN ic_counterparties s ON s.id = p.counterparty_id
       LEFT JOIN ic_warehouses w ON w.id = p.warehouse_id
       WHERE p.settlement_mode = $${purchaseModeIndex}
         ${branchFilter.replace(/\bw\./g, 'w.')}
         ${purchaseDate.sql.replace(/\bt\./g, 'p.')}
       ORDER BY p.created_at ASC, p.id ASC`,
      [...branchParams, ...purchaseDate.params, settlementMode],
    );

    const saleDate = buildTradeDateFilter(startDate, endDate, branchParams.length + 1);
    const saleModeIndex = branchParams.length + 1 + saleDate.params.length;
    const salesRes = await query(
      `SELECT
         s.id,
         s.created_at,
         s.units,
         s.unit_rate,
         s.aed_amount,
         s.service_charge,
         s.inr_total,
         s.lab_total_inr,
         s.metal_weight_g,
         s.metal_rate_inr_per_g,
         s.metal_rate_aed_per_g,
         s.metal_payment_method,
         s.split_inr_paid,
         s.split_aed_paid,
         s.metal_purchase_id,
         s.payment_status,
         s.order_status,
         s.customer_name,
         s.order_customer_name,
         s.rejection_remarks,
         w.id AS warehouse_id,
         w.name AS warehouse_name,
         w.code AS warehouse_code,
         cp.id AS counterparty_id,
         cp.name AS customer_master_name,
         cp.code AS customer_code,
         mp.inr_total AS lot_purchase_inr,
         mp.lab_total_inr AS lot_purchase_lab,
         mp.aed_total AS lot_purchase_aed,
         mp.metal_rate_aed_per_g AS lot_purchase_rate_aed_per_g,
         mp.split_aed_paid AS lot_purchase_split_aed_paid,
         mp.metal_weight_g AS lot_purchase_g,
         mp.metal_payment_method AS lot_payment_method
       FROM ic_sales s
       LEFT JOIN ic_warehouses w ON w.id = s.warehouse_id
       LEFT JOIN ic_counterparties cp ON cp.id = s.counterparty_id
       LEFT JOIN ic_purchases mp ON mp.id = s.metal_purchase_id
       WHERE s.settlement_mode = $${saleModeIndex}
         ${includeVoidOrders ? '' : sqlExcludeVoidIcSales('s')}
         ${branchFilter}
         ${saleDate.sql.replace(/\bt\./g, 's.')}
       ORDER BY s.created_at ASC, s.id ASC`,
      [...branchParams, ...saleDate.params, settlementMode],
    );

    const settlementLabel = settlementMode === 'metal' ? 'Metal' : 'Fund (cash)';

    const purchases: ICSettlementTradeLine[] = purchaseRes.rows.map(row => {
      const units = Number(row.units) || 0;
      const aedTotal = purchaseAedTotal(units, Number(row.unit_rate) || 0, row.aed_total);
      const inrNotional =
        settlementMode === 'cash'
          ? row.inr_total != null
            ? Number(row.inr_total)
            : units * INR_PER_UNIT
          : undefined;
      const unitRate = resolveTradeUnitRateAed(
        units,
        Number(row.unit_rate) || 0,
        aedTotal,
        inrNotional,
      );
      const id = String(row.id);
      return {
        id,
        txnKind: 'purchase',
        date: row.created_at ? String(row.created_at) : '',
        reference: getFormattedTxnId(id, 'purchase', { id }),
        counterparty: row.supplier_name ? String(row.supplier_name) : '—',
        counterpartyCode: row.supplier_code ? String(row.supplier_code) : undefined,
        counterpartyId: row.counterparty_id ? String(row.counterparty_id) : undefined,
        warehouseId: row.warehouse_id ? String(row.warehouse_id) : undefined,
        warehouseName: row.warehouse_name ? String(row.warehouse_name) : undefined,
        warehouseCode: row.warehouse_code ? String(row.warehouse_code) : undefined,
        units,
        unitRateAed: unitRate,
        aedTotal,
        inrTotal:
          row.inr_total != null
            ? settlementMode === 'metal'
              ? netMetalInr(Number(row.inr_total) || 0, Number(row.lab_total_inr) || 0)
              : Number(row.inr_total)
            : undefined,
        metalWeightG: row.metal_weight_g != null ? Number(row.metal_weight_g) : undefined,
        metalRateInrPerG: row.metal_rate_inr_per_g != null ? Number(row.metal_rate_inr_per_g) : undefined,
        metalRateAedPerG: row.metal_rate_aed_per_g != null ? Number(row.metal_rate_aed_per_g) : undefined,
        settlementLabel,
        metalPaymentMethod:
          settlementMode === 'metal' ? tradeLinePaymentFromDb(row.metal_payment_method) : undefined,
        splitInrPaid: row.split_inr_paid != null ? Number(row.split_inr_paid) : undefined,
        splitAedPaid: row.split_aed_paid != null ? Number(row.split_aed_paid) : undefined,
        paymentMethod: row.payment_method ? String(row.payment_method) : undefined,
        paymentStatus: row.payment_status ? String(row.payment_status) : undefined,
        notes: row.notes ? String(row.notes) : undefined,
      };
    });

    const sales: ICSettlementTradeLine[] = salesRes.rows.map(row => {
      const units = Number(row.units) || 0;
      const aedTotal = (Number(row.aed_amount) || 0) + (Number(row.service_charge) || 0);
      const inrNotional =
        settlementMode === 'cash'
          ? row.inr_total != null
            ? Number(row.inr_total)
            : units * INR_PER_UNIT
          : undefined;
      const unitRate = resolveTradeUnitRateAed(
        units,
        Number(row.unit_rate) || 0,
        aedTotal,
        inrNotional,
      );
      const id = String(row.id);
      const counterparty = String(row.order_customer_name || row.customer_master_name || row.customer_name || 'Customer');
      const saleG = row.metal_weight_g != null ? Number(row.metal_weight_g) : 0;
      const salePay = tradeLinePaymentFromDb(row.metal_payment_method);
      const pl =
        settlementMode === 'metal'
          ? computeMetalLotProfit({
              paymentMethod: salePay === 'INR' ? 'CASH' : salePay === 'SPLIT' ? 'SPLIT' : 'AED',
              purchasePaymentMethod: !row.lot_payment_method
                ? 'CASH'
                : tradeLinePaymentFromDb(row.lot_payment_method) === 'INR'
                  ? 'CASH'
                  : tradeLinePaymentFromDb(row.lot_payment_method) === 'SPLIT'
                    ? 'SPLIT'
                    : 'AED',
              weightG: saleG,
              purchaseInr: allocateMetalLotCostInr(
                {
                  inrTotal: Number(row.lot_purchase_inr) || 0,
                  metalWeightG: Number(row.lot_purchase_g) || 0,
                  labTotalInr: Number(row.lot_purchase_lab) || 0,
                },
                saleG,
              ),
              purchaseAed: allocateMetalLotBookedCostAed(
                {
                  aedTotal: Number(row.lot_purchase_aed) || 0,
                  splitAedPaid: Number(row.lot_purchase_split_aed_paid) || 0,
                  paymentMethod: row.lot_payment_method ? String(row.lot_payment_method) : null,
                  metalWeightG: Number(row.lot_purchase_g) || 0,
                  metalRateAedPerG: Number(row.lot_purchase_rate_aed_per_g) || 0,
                },
                saleG,
              ),
              saleInr: netMetalInr(Number(row.inr_total) || 0, Number(row.lab_total_inr) || 0),
              saleAed: aedTotal,
              saleSplitAedPaid: Number(row.split_aed_paid) || 0,
            })
          : null;
      return {
        id,
        txnKind: 'sale',
        date: row.created_at ? String(row.created_at) : '',
        reference: getFormattedTxnId(id, 'sale', {
          id,
          customer_name: row.customer_name,
          order_customer_name: row.order_customer_name,
        }),
        counterparty,
        counterpartyCode: row.customer_code ? String(row.customer_code) : undefined,
        counterpartyId: row.counterparty_id ? String(row.counterparty_id) : undefined,
        warehouseId: row.warehouse_id ? String(row.warehouse_id) : undefined,
        warehouseName: row.warehouse_name ? String(row.warehouse_name) : undefined,
        warehouseCode: row.warehouse_code ? String(row.warehouse_code) : undefined,
        units,
        unitRateAed: unitRate,
        aedTotal,
        inrTotal:
          row.inr_total != null
            ? settlementMode === 'metal'
              ? netMetalInr(Number(row.inr_total) || 0, Number(row.lab_total_inr) || 0)
              : Number(row.inr_total)
            : undefined,
        metalWeightG: row.metal_weight_g != null ? Number(row.metal_weight_g) : undefined,
        metalRateInrPerG: row.metal_rate_inr_per_g != null ? Number(row.metal_rate_inr_per_g) : undefined,
        metalRateAedPerG: row.metal_rate_aed_per_g != null ? Number(row.metal_rate_aed_per_g) : undefined,
        settlementLabel,
        metalPaymentMethod: settlementMode === 'metal' ? salePay : undefined,
        splitInrPaid: row.split_inr_paid != null ? Number(row.split_inr_paid) : undefined,
        splitAedPaid: row.split_aed_paid != null ? Number(row.split_aed_paid) : undefined,
        bookedProfit: pl?.bookedProfit,
        bookedCurrency: pl?.bookedCurrency,
        bookedProfitAed: pl?.bookedProfitAed,
        bookedProfitInr: pl?.bookedProfitInr,
        paymentStatus: row.payment_status ? String(row.payment_status) : undefined,
        orderStatus: row.order_status ? String(row.order_status) : undefined,
        notes: row.rejection_remarks ? String(row.rejection_remarks) : undefined,
      };
    });

    const summary = summarizeSettlementTrades(purchases, sales);

    return {
      success: true,
      data: {
        settlementMode,
        purchases,
        sales,
        summary,
      },
    };
  } catch (err) {
    logger.error({ err, settlementMode }, 'Failed to load settlement trade report');
    return { success: false, error: 'Failed to load trade register' };
  }
}
