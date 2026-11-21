import type { PlStatement } from '@/lib/icFunds/reportPresentation';
import type { ICWarehousePLReport } from '@/lib/icFunds/warehouseProfit';

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
  /** Operational IC profit, sourced from warehouse sales and WAC cost for the selected period. */
  icProfit: Pick<ICWarehousePLReport['totals'], 'revenue' | 'cogs' | 'grossProfit'>;
  startDate: string | null;
  endDate: string | null;
};
