import type { ICFundAccountType } from '@/types';
import { trialBalanceSplit } from '@/lib/icFunds/accountBalance';

/** Per-account trial balance / ledger period columns (posted active vouchers only). */
export type AccountPeriodLedger = {
  accountId: string;
  accountName: string;
  accountType: ICFundAccountType;
  opening: number;
  periodDebit: number;
  periodCredit: number;
  closing: number;
  pendingBalance: number;
};

export type TrialBalanceRow = {
  accountId: string;
  accountName: string;
  accountType: ICFundAccountType;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
  pendingDebit: number;
  pendingCredit: number;
  debit: number;
  credit: number;
};

export function mapRowToPeriodLedger(row: Record<string, unknown>): AccountPeriodLedger {
  return {
    accountId: String(row.id),
    accountName: String(row.name),
    accountType: row.account_type as ICFundAccountType,
    opening: Number(row.period_opening) || 0,
    periodDebit: Number(row.period_debit) || 0,
    periodCredit: Number(row.period_credit) || 0,
    closing: Number(row.closing_balance) || 0,
    pendingBalance: Number(row.pending_balance) || 0,
  };
}

export function toTrialBalanceRow(ledger: AccountPeriodLedger): TrialBalanceRow {
  const open = trialBalanceSplit(ledger.opening);
  const close = trialBalanceSplit(ledger.closing);
  const pending = trialBalanceSplit(ledger.pendingBalance);
  return {
    accountId: ledger.accountId,
    accountName: ledger.accountName,
    accountType: ledger.accountType,
    openingDebit: round2(open.debit),
    openingCredit: round2(open.credit),
    periodDebit: round2(ledger.periodDebit),
    periodCredit: round2(ledger.periodCredit),
    closingDebit: round2(close.debit),
    closingCredit: round2(close.credit),
    pendingDebit: round2(pending.debit),
    pendingCredit: round2(pending.credit),
    debit: round2(close.debit),
    credit: round2(close.credit),
  };
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

const ACTIVE = `COALESCE(v.status, 'active') = 'active'`;
const INR_ACTIVE = `COALESCE(v.status, 'active') = 'active'`;

function sumDebitSql(branchParam: string, dateClause: string): string {
  return `(SELECT COALESCE(SUM(v.amount), 0) FROM ic_fund_vouchers v
    WHERE ${ACTIVE} AND v.branch_id = ${branchParam} AND v.debit_account_id = a.id ${dateClause})`;
}

function sumCreditSql(branchParam: string, dateClause: string): string {
  return `(SELECT COALESCE(SUM(v.amount), 0) FROM ic_fund_vouchers v
    WHERE ${ACTIVE} AND v.branch_id = ${branchParam} AND v.credit_account_id = a.id ${dateClause})`;
}

function inrSumDebitSql(branchParam: string, dateClause: string): string {
  return `(SELECT COALESCE(SUM(v.amount), 0) FROM inr_fund_vouchers v
    WHERE ${INR_ACTIVE} AND v.branch_id = ${branchParam} AND v.debit_account_id = a.id ${dateClause})`;
}

function inrSumCreditSql(branchParam: string, dateClause: string): string {
  return `(SELECT COALESCE(SUM(v.amount), 0) FROM inr_fund_vouchers v
    WHERE ${INR_ACTIVE} AND v.branch_id = ${branchParam} AND v.credit_account_id = a.id ${dateClause})`;
}

/**
 * Extra SELECT columns on ic_fund_accounts alias `a`.
 * $1 = branchId; optional $2 startDate; optional $3 endDate (see fetchAccountsWithPeriodBalances).
 */
export function accountPeriodBalanceSelectSql(opts: {
  branchParam: string;
  startParam: string | null;
  endParam: string | null;
}): string {
  const { branchParam, startParam, endParam } = opts;

  const beforeStart =
    startParam != null ? `AND v.voucher_date < ${startParam}::date` : '';
  const periodFrom =
    startParam != null ? `AND v.voucher_date >= ${startParam}::date` : '';
  const periodTo = endParam != null ? `AND v.voucher_date <= ${endParam}::date` : '';
  const throughEnd = endParam != null ? `AND v.voucher_date <= ${endParam}::date` : '';

  const openingMovement =
    startParam != null
      ? `(${sumDebitSql(branchParam, beforeStart)} - ${sumCreditSql(branchParam, beforeStart)})`
      : '0';

  const periodOpening = `(a.opening_balance + ${openingMovement})`;
  const periodDebit = sumDebitSql(branchParam, `${periodFrom} ${periodTo}`);
  const periodCredit = sumCreditSql(branchParam, `${periodFrom} ${periodTo}`);
  const closingBalance = `(a.opening_balance + ${sumDebitSql(branchParam, throughEnd)} - ${sumCreditSql(branchParam, throughEnd)})`;

  return `${periodOpening} AS period_opening,
    ${periodDebit} AS period_debit,
    ${periodCredit} AS period_credit,
    ${closingBalance} AS closing_balance`;
}

/** Period columns for inr_fund_accounts alias `a` (same param numbering as IC). */
export function inrAccountPeriodBalanceSelectSql(opts: {
  branchParam: string;
  startParam: string | null;
  endParam: string | null;
}): string {
  const { branchParam, startParam, endParam } = opts;

  const beforeStart =
    startParam != null ? `AND v.voucher_date < ${startParam}::date` : '';
  const periodFrom =
    startParam != null ? `AND v.voucher_date >= ${startParam}::date` : '';
  const periodTo = endParam != null ? `AND v.voucher_date <= ${endParam}::date` : '';
  const throughEnd = endParam != null ? `AND v.voucher_date <= ${endParam}::date` : '';

  const openingMovement =
    startParam != null
      ? `(${inrSumDebitSql(branchParam, beforeStart)} - ${inrSumCreditSql(branchParam, beforeStart)})`
      : '0';

  const periodOpening = `(a.opening_balance + ${openingMovement})`;
  const periodDebit = inrSumDebitSql(branchParam, `${periodFrom} ${periodTo}`);
  const periodCredit = inrSumCreditSql(branchParam, `${periodFrom} ${periodTo}`);
  const closingBalance = `(a.opening_balance + ${inrSumDebitSql(branchParam, throughEnd)} - ${inrSumCreditSql(branchParam, throughEnd)})`;

  return `${periodOpening} AS period_opening,
    ${periodDebit} AS period_debit,
    ${periodCredit} AS period_credit,
    ${closingBalance} AS closing_balance`;
}
