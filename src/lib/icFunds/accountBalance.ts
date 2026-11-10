import type { ICFundAccountType } from '@/types';

/**
 * Balance = opening_balance + active debits − active credits.
 * Pending vouchers are listed in ledgers but excluded from posted balance until active.
 */

export const VOUCHER_LEDGER_STATUS_SQL = `COALESCE(v.status, 'active') IN ('active', 'pending')`;

function movementWhereSql(
  statusSql: string,
  opts?: {
    asOfParam?: string | null;
    branchParam?: string | null;
    accountParam?: string | null;
  },
): string {
  const dateFilter = opts?.asOfParam ? `AND v.voucher_date <= ${opts.asOfParam}` : '';
  const branchFilter = opts?.branchParam ? `AND v.branch_id = ${opts.branchParam}` : '';
  const accountFilter = opts?.accountParam
    ? `AND (v.debit_account_id = ${opts.accountParam} OR v.credit_account_id = ${opts.accountParam})`
    : '';
  return `${statusSql} ${dateFilter} ${branchFilter} ${accountFilter}`;
}

type VoucherLedgerTable = 'ic_fund_vouchers' | 'inr_fund_vouchers';

function accountMovementJoinAlias(
  alias: string,
  statusSql: string,
  voucherTable: VoucherLedgerTable,
  opts?: {
    asOfParam?: string | null;
    branchParam?: string | null;
    accountParam?: string | null;
  },
): string {
  const where = movementWhereSql(statusSql, opts);
  return `LEFT JOIN (
    SELECT x.account_id, SUM(x.delta) AS movement
    FROM (
      SELECT v.debit_account_id AS account_id, v.amount AS delta
      FROM ${voucherTable} v
      WHERE ${where}
      UNION ALL
      SELECT v.credit_account_id AS account_id, -v.amount AS delta
      FROM ${voucherTable} v
      WHERE ${where}
    ) x
    GROUP BY x.account_id
  ) ${alias} ON ${alias}.account_id = a.id`;
}

export function accountMovementJoinSql(opts?: {
  asOfParam?: string | null;
  branchParam?: string | null;
  accountParam?: string | null;
}): string {
  return accountMovementJoinAlias('m', `COALESCE(v.status, 'active') = 'active'`, 'ic_fund_vouchers', opts);
}

export function accountPendingMovementJoinSql(opts?: {
  asOfParam?: string | null;
  branchParam?: string | null;
  accountParam?: string | null;
}): string {
  return accountMovementJoinAlias('pm', `COALESCE(v.status, 'active') = 'pending'`, 'ic_fund_vouchers', opts);
}

export function inrAccountMovementJoinSql(opts?: {
  asOfParam?: string | null;
  branchParam?: string | null;
  accountParam?: string | null;
}): string {
  return accountMovementJoinAlias('m', `COALESCE(v.status, 'active') = 'active'`, 'inr_fund_vouchers', opts);
}

export function inrAccountPendingMovementJoinSql(opts?: {
  asOfParam?: string | null;
  branchParam?: string | null;
  accountParam?: string | null;
}): string {
  return accountMovementJoinAlias('pm', `COALESCE(v.status, 'active') = 'pending'`, 'inr_fund_vouchers', opts);
}

export function inrAccountBalanceSql(_asOfParam?: string | null): string {
  return `(a.opening_balance + COALESCE(m.movement, 0))`;
}

export function accountBalanceSql(_asOfParam?: string | null): string {
  return `(a.opening_balance + COALESCE(m.movement, 0))`;
}

/** Lifetime posted debits / credits per account (active vouchers). */
export function accountLedgerDebitSumSql(
  branchParam: string,
  voucherTable: VoucherLedgerTable = 'ic_fund_vouchers',
): string {
  return `(SELECT COALESCE(SUM(v.amount), 0) FROM ${voucherTable} v
    WHERE COALESCE(v.status, 'active') = 'active'
      AND v.branch_id = ${branchParam} AND v.debit_account_id = a.id)`;
}

export function accountLedgerCreditSumSql(
  branchParam: string,
  voucherTable: VoucherLedgerTable = 'ic_fund_vouchers',
): string {
  return `(SELECT COALESCE(SUM(v.amount), 0) FROM ${voucherTable} v
    WHERE COALESCE(v.status, 'active') = 'active'
      AND v.branch_id = ${branchParam} AND v.credit_account_id = a.id)`;
}

export function accountPendingBalanceSql(): string {
  return `COALESCE(pm.movement, 0)`;
}

export function trialBalanceSplit(balance: number): { debit: number; credit: number } {
  if (balance > 0) return { debit: balance, credit: 0 };
  if (balance < 0) return { debit: 0, credit: Math.abs(balance) };
  return { debit: 0, credit: 0 };
}

/** Ledger balance → signed P&L amount (income/profit positive, expenses negative). */
export function plDisplayBalance(accountType: ICFundAccountType, ledgerBalance: number): number {
  switch (accountType) {
    case 'income':
    case 'profit':
      return -ledgerBalance;
    case 'expense':
    case 'd_expense':
      return -ledgerBalance;
    default:
      return ledgerBalance;
  }
}

/** Period totals from vouchers → signed P&L amount for summary rows. */
export function plSummaryAmount(
  kind: 'income' | 'profit' | 'expense' | 'd_expense',
  amount: number,
): number {
  if (kind === 'expense' || kind === 'd_expense') return -amount;
  return amount;
}

function plVoucherMovementDelta(
  accountType: ICFundAccountType,
  side: 'debit' | 'credit',
  amount: number,
): number {
  switch (accountType) {
    case 'income':
    case 'profit':
      return side === 'credit' ? amount : -amount;
    case 'expense':
    case 'd_expense':
      return side === 'debit' ? -amount : amount;
    default:
      return 0;
  }
}

/** Period movement from ledger period columns (avoids loading every voucher on P&L). */
export function plPeriodMovementFromLedger(ledger: {
  accountType: ICFundAccountType;
  periodDebit: number;
  periodCredit: number;
}): number {
  return (
    plVoucherMovementDelta(ledger.accountType, 'debit', ledger.periodDebit) +
    plVoucherMovementDelta(ledger.accountType, 'credit', ledger.periodCredit)
  );
}

/** Period voucher activity for one P&L account, using natural P&L signs. */
export function plPeriodMovement(
  accountId: string,
  accountType: ICFundAccountType,
  vouchers: ReadonlyArray<{
    debitAccountId: string;
    creditAccountId: string;
    amount: number;
    status?: string | null;
  }>,
): number {
  let total = 0;
  for (const voucher of vouchers) {
    if (voucher.status === 'void') continue;
    if (voucher.debitAccountId === accountId) {
      total += plVoucherMovementDelta(accountType, 'debit', voucher.amount);
    }
    if (voucher.creditAccountId === accountId) {
      total += plVoucherMovementDelta(accountType, 'credit', voucher.amount);
    }
  }
  return total;
}
