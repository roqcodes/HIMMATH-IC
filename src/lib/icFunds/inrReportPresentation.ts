import type { ICFundAccountType } from '@/types';
import { plPeriodMovement } from '@/lib/icFunds/accountBalance';
import type { AccountPeriodLedger } from '@/lib/icFunds/accountPeriodBalance';
import type { PlStatement } from '@/lib/icFunds/reportPresentation';

export type InrProfitLossTotals = {
  income: number;
  profit: number;
  expense: number;
};

type InrVoucherMovement = {
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
  status?: string | null;
};

/** INR metal ledger P&L — expense accounts are cost of metal sold (no d_expense book). */
export function buildInrPlStatement(
  ledgers: AccountPeriodLedger[],
  periodVouchers: ReadonlyArray<InrVoucherMovement>,
  totals: InrProfitLossTotals,
): PlStatement {
  const plAccounts = ledgers.filter(a =>
    (['income', 'profit', 'expense'] as const).includes(a.accountType as 'income' | 'profit' | 'expense'),
  );

  const lineFor = (accountType: ICFundAccountType): PlStatement['incomeLines'] =>
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
  const directCostsTotal = Number(totals.expense.toFixed(2));
  const operatingTotal = 0;
  const grossResult = Number((salesTotal - directCostsTotal).toFixed(2));
  const netForPeriod = Number((totals.income + totals.profit - totals.expense).toFixed(2));

  return {
    salesTotal,
    directCostsTotal,
    grossResult,
    operatingTotal,
    netForPeriod,
    profitTransferred: Number(totals.profit.toFixed(2)),
    incomeLines: lineFor('income'),
    directCostLines: lineFor('expense'),
    operatingLines: [],
    profitLines: lineFor('profit'),
  };
}
