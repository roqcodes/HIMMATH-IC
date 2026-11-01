import type { DateFilterRange } from '@/lib/dateFilterRange';
import { computeDealProfit } from '@/lib/icTransfer/dealProfit';
import {
  filterCounterpartyPurchases,
  filterCounterpartySales,
  purchaseMatchesCounterparty,
  saleMatchesCounterparty,
} from '@/lib/counterparties/counterpartyActivity';
import type { ICPurchase, ICSale } from '@/types';

export type CounterpartyDealMetrics = {
  cashPurchases: number;
  metalPurchases: number;
  cashSales: number;
  metalSales: number;
  cashPurchaseAed: number;
  metalPurchaseAed: number;
  cashSaleAed: number;
  metalSaleAed: number;
  cashGrossProfitAed: number;
  metalProfitAed: number;
  metalProfitInr: number;
};

function isMetal(mode: string | undefined): boolean {
  return mode === 'metal';
}

function countPurchases(purchases: ICPurchase[], metal: boolean): number {
  return purchases.filter(p => isMetal(p.settlementMode) === metal).length;
}

function countSales(sales: ICSale[], metal: boolean): number {
  return sales.filter(s => isMetal(s.settlementMode) === metal).length;
}

function sumPurchaseAed(purchases: ICPurchase[], metal: boolean): number {
  return purchases
    .filter(p => isMetal(p.settlementMode) === metal)
    .reduce((sum, p) => sum + (Number(p.aedTotal) || 0), 0);
}

function sumSaleAed(sales: ICSale[], metal: boolean): number {
  return sales
    .filter(s => isMetal(s.settlementMode) === metal)
    .reduce((sum, s) => sum + (Number(s.aedAmount) || 0) + (Number(s.serviceCharge) || 0), 0);
}

export function computeSingleCounterpartyMetrics(
  counterpartyId: string,
  allPurchases: ICPurchase[],
  allSales: ICSale[],
  range: DateFilterRange,
): CounterpartyDealMetrics {
  const partyPurchases = allPurchases.filter(p => purchaseMatchesCounterparty(p, counterpartyId));
  const partySales = allSales.filter(s => saleMatchesCounterparty(s, counterpartyId));
  const inRangePurchases = filterCounterpartyPurchases(allPurchases, counterpartyId, range);
  const inRangeSales = filterCounterpartySales(allSales, counterpartyId, range);
  const profit = computeDealProfit({
    purchases: partyPurchases,
    sales: partySales,
    range,
  });

  return {
    cashPurchases: countPurchases(inRangePurchases, false),
    metalPurchases: countPurchases(inRangePurchases, true),
    cashSales: countSales(inRangeSales, false),
    metalSales: countSales(inRangeSales, true),
    cashPurchaseAed: sumPurchaseAed(inRangePurchases, false),
    metalPurchaseAed: sumPurchaseAed(inRangePurchases, true),
    cashSaleAed: sumSaleAed(inRangeSales, false),
    metalSaleAed: sumSaleAed(inRangeSales, true),
    cashGrossProfitAed: profit.cashGrossProfitAed,
    metalProfitAed: profit.metalProfitAed,
    metalProfitInr: profit.metalProfitInr,
  };
}

export function counterpartyTotalProfitAed(cashGrossProfitAed: number, metalProfitAed: number): number {
  return Number((cashGrossProfitAed + metalProfitAed).toFixed(2));
}
