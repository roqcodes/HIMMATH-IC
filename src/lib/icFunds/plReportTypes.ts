import type { PlStatement } from '@/lib/icFunds/reportPresentation';

export type MetalPlPeriodKpis = {
  metalSoldG: number;
  metalSaleInr: number;
  metalCogsInr: number;
  metalProfitInr: number;
  metalFxProfitAed: number;
};

export type ICFundProfitLossReport = {
  plStatement: PlStatement;
  profitLoss: {
    income: number;
    profit: number;
    expense: number;
    dExpense: number;
    net: number;
  };
  metalPl: MetalPlPeriodKpis;
  startDate: string | null;
  endDate: string | null;
};
