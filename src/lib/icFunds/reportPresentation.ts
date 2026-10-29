import type { ICFundAccountType } from '@/types';
import { plPeriodMovement } from '@/lib/icFunds/accountBalance';
import type { AccountPeriodLedger } from '@/lib/icFunds/accountPeriodBalance';
import type { ICFundVoucher } from '@/types';

export type PlAccountLine = {
  accountId: string;
  accountName: string;
  amount: number;
};

export type PlStatement = {
  salesTotal: number;
  directCostsTotal: number;
  grossResult: number;
  operatingTotal: number;
  netForPeriod: number;
  profitTransferred: number;
  incomeLines: PlAccountLine[];
  directCostLines: PlAccountLine[];
  operatingLines: PlAccountLine[];
  profitLines: PlAccountLine[];
};

export type BalanceSheetLine = {
  accountId?: string;
  label: string;
  amount: number;
  section: 'asset' | 'liability' | 'equity';
};

export type BalanceSheetPresentation = {
  assets: BalanceSheetLine[];
  liabilities: BalanceSheetLine[];
  equity: BalanceSheetLine[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesEquity: number;
  balanced: boolean;
  outOfBalance: number;
};

type ProfitLossTotals = {
  income: number;
  profit: number;
  expense: number;
  dExpense: number;
};

export function buildPlStatement(
  ledgers: AccountPeriodLedger[],
  periodVouchers: ReadonlyArray<ICFundVoucher>,
  totals: ProfitLossTotals,
): PlStatement {
  const plAccounts = ledgers.filter(a =>
    ['income', 'profit', 'expense', 'd_expense'].includes(a.accountType),
  );

  const lineFor = (accountType: ICFundAccountType): PlAccountLine[] =>
    plAccounts
      .filter(a => a.accountType === accountType)
      .map(a => ({
        accountId: a.accountId,
        accountName: a.accountName,
        amount: Number(
          plPeriodMovement(a.accountId, a.accountType, periodVouchers).toFixed(2),
        ),
      }))
      .filter(l => Math.abs(l.amount) > 0.005)
      .sort((x, y) => x.accountName.localeCompare(y.accountName));

  const salesTotal = Number((totals.income + totals.profit).toFixed(2));
  const directCostsTotal = Number(totals.dExpense.toFixed(2));
  const operatingTotal = Number(totals.expense.toFixed(2));
  const grossResult = Number((salesTotal - directCostsTotal).toFixed(2));
  const netForPeriod = Number(
    (totals.income + totals.profit - totals.expense - totals.dExpense).toFixed(2),
  );

  return {
    salesTotal,
    directCostsTotal,
    grossResult,
    operatingTotal,
    netForPeriod,
    profitTransferred: Number(totals.profit.toFixed(2)),
    incomeLines: lineFor('income'),
    directCostLines: lineFor('d_expense'),
    operatingLines: lineFor('expense'),
    profitLines: lineFor('profit'),
  };
}

export function buildBalanceSheetPresentation(
  ledgers: AccountPeriodLedger[],
  netForPeriod: number,
): BalanceSheetPresentation {
  const assets: BalanceSheetLine[] = [];
  const liabilities: BalanceSheetLine[] = [];
  const equity: BalanceSheetLine[] = [];

  for (const a of ledgers) {
    const closing = a.closing;
    if (Math.abs(closing) < 0.005) continue;

    if (a.accountType === 'bank') {
      assets.push({
        accountId: a.accountId,
        label: a.accountName,
        amount: closing,
        section: 'asset',
      });
    } else if (a.accountType === 'personal') {
      if (closing > 0) {
        assets.push({
          accountId: a.accountId,
          label: a.accountName,
          amount: closing,
          section: 'asset',
        });
      } else {
        liabilities.push({
          accountId: a.accountId,
          label: a.accountName,
          amount: Math.abs(closing),
          section: 'liability',
        });
      }
    } else if (a.accountType === 'profit') {
      const reserve = -closing;
      if (Math.abs(reserve) > 0.005) {
        equity.push({
          accountId: a.accountId,
          label: a.accountName,
          amount: reserve,
          section: 'equity',
        });
      }
    }
  }

  if (Math.abs(netForPeriod) > 0.005) {
    equity.push({
      label: 'Current period result',
      amount: netForPeriod,
      section: 'equity',
    });
  }

  assets.sort((x, y) => x.label.localeCompare(y.label));
  liabilities.sort((x, y) => x.label.localeCompare(y.label));
  equity.sort((x, y) => x.label.localeCompare(y.label));

  const totalAssets = Number(assets.reduce((s, l) => s + l.amount, 0).toFixed(2));
  const totalLiabilities = Number(liabilities.reduce((s, l) => s + l.amount, 0).toFixed(2));
  const totalEquity = Number(equity.reduce((s, l) => s + l.amount, 0).toFixed(2));
  const totalLiabilitiesEquity = Number((totalLiabilities + totalEquity).toFixed(2));
  const outOfBalance = Number((totalAssets - totalLiabilitiesEquity).toFixed(2));
  const balanced = Math.abs(outOfBalance) < 0.01;

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesEquity,
    balanced,
    outOfBalance,
  };
}

export type TrialBalanceGroupId =
  | 'assets'
  | 'liabilities'
  | 'income'
  | 'direct_costs'
  | 'expenses'
  | 'equity'
  | 'other';

export function trialBalanceGroup(accountType: ICFundAccountType): TrialBalanceGroupId {
  switch (accountType) {
    case 'bank':
      return 'assets';
    case 'personal':
      return 'assets';
    case 'income':
      return 'income';
    case 'd_expense':
      return 'direct_costs';
    case 'expense':
      return 'expenses';
    case 'profit':
      return 'equity';
    default:
      return 'other';
  }
}

export const TRIAL_BALANCE_GROUP_LABELS: Record<TrialBalanceGroupId, string> = {
  assets: 'Assets & receivables',
  liabilities: 'Liabilities & payables',
  income: 'Income',
  direct_costs: 'Direct costs',
  expenses: 'Operating expenses',
  equity: 'Equity / profit reserve',
  other: 'Other',
};
