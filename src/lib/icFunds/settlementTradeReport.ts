import { roundMoney } from '@/lib/icFunds/currencyPolicy';
import { isMetalAedPayment, isMetalSplitPayment, normalizeMetalPaymentMethod } from '@/lib/domain/books';
import { computeIcCashRateFromTotals } from '@/lib/icTransfer/rateCalculations';
import type { ICSettlementMode } from '@/lib/icTransfer/metalSettlement';

export type ICSettlementTradeLine = {
  id: string;
  txnKind: 'purchase' | 'sale';
  date: string;
  reference: string;
  counterparty: string;
  counterpartyCode?: string;
  counterpartyId?: string;
  warehouseId?: string;
  warehouseName?: string;
  warehouseCode?: string;
  units: number;
  unitRateAed: number;
  aedTotal: number;
  inrTotal?: number;
  metalWeightG?: number;
  metalRateInrPerG?: number;
  metalRateAedPerG?: number;
  settlementLabel: string;
  metalPaymentMethod?: 'INR' | 'AED' | 'SPLIT';
  splitInrPaid?: number;
  splitAedPaid?: number;
  bookedProfit?: number;
  bookedCurrency?: 'AED' | 'INR';
  bookedProfitAed?: number;
  bookedProfitInr?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  orderStatus?: string;
  notes?: string;
  aedAgentName?: string;
};

export type ICSettlementTradeSummary = {
  purchaseCount: number;
  saleCount: number;
  purchaseUnits: number;
  saleUnits: number;
  purchaseAed: number;
  saleAed: number;
  purchaseInr: number;
  saleInr: number;
  metalWeightPurchasedG: number;
  metalWeightSoldG: number;
  bookedInrProfit: number;
  bookedAedProfit: number;
};

export type ICSettlementTradeReport = {
  settlementMode: ICSettlementMode;
  purchases: ICSettlementTradeLine[];
  sales: ICSettlementTradeLine[];
  summary: ICSettlementTradeSummary;
};

function money(n: number): number {
  return roundMoney(Number.isFinite(n) ? n : 0);
}

function roundQty(n: number): number {
  return Number((Number.isFinite(n) ? n : 0).toFixed(4));
}

function roundRate(n: number): number {
  return Number((Number.isFinite(n) ? n : 0).toFixed(4));
}

/** Cash-metal / split INR. AED-agent INR is a rate memo. */
export function tradeLineBookInr(row: ICSettlementTradeLine): number {
  if (row.metalPaymentMethod === 'SPLIT') return Number(row.splitInrPaid) || 0;
  if (row.metalPaymentMethod === 'AED' || isMetalAedPayment(row.metalPaymentMethod)) return 0;
  return Number(row.inrTotal) || 0;
}

/** Cash IC + metal AED / split AED. Cash-metal AED is ignored. */
export function tradeLineBookAed(row: ICSettlementTradeLine): number {
  if (row.metalPaymentMethod === 'SPLIT') return Number(row.splitAedPaid) || 0;
  if (row.metalPaymentMethod === 'INR') return 0;
  return Number(row.aedTotal) || 0;
}

export function tradeLinePaymentFromDb(value: unknown): 'INR' | 'AED' | 'SPLIT' | undefined {
  if (value == null || String(value).trim() === '') return undefined;
  const pay = normalizeMetalPaymentMethod(String(value));
  if (pay === 'SPLIT') return 'SPLIT';
  return pay === 'AED' ? 'AED' : 'INR';
}

/**
 * Stored unit_rate for cash IC is sheet R (~36.5). **AED = units × rate × 100** when inferring from totals.
 */
export function resolveTradeUnitRateAed(
  units: number,
  unitRate: number,
  aedTotal: number,
  _inrNotional?: number | null,
): number {
  const rate = Number(unitRate);
  if (Number.isFinite(rate) && rate > 0) return roundRate(rate);
  const u = Number(units);
  const aed = Number(aedTotal);
  if (Number.isFinite(u) && u > 0 && Number.isFinite(aed) && aed > 0) {
    return roundRate(computeIcCashRateFromTotals(u, aed));
  }
  return 0;
}

export function summarizeSettlementTrades(
  purchases: ICSettlementTradeLine[],
  sales: ICSettlementTradeLine[],
): ICSettlementTradeSummary {
  const purchaseUnits = purchases.reduce((s, r) => s + r.units, 0);
  const saleUnits = sales.reduce((s, r) => s + r.units, 0);
  const purchaseAed = purchases.reduce((s, r) => s + tradeLineBookAed(r), 0);
  const saleAed = sales.reduce((s, r) => s + tradeLineBookAed(r), 0);
  const purchaseInr = purchases.reduce((s, r) => s + tradeLineBookInr(r), 0);
  const saleInr = sales.reduce((s, r) => s + tradeLineBookInr(r), 0);
  const metalWeightPurchasedG = purchases.reduce((s, r) => s + (r.metalWeightG ?? 0), 0);
  const metalWeightSoldG = sales.reduce((s, r) => s + (r.metalWeightG ?? 0), 0);
  const bookedAedProfit = sales.reduce(
    (s, r) => s + (r.bookedProfitAed ?? (r.bookedCurrency === 'AED' ? r.bookedProfit ?? 0 : 0)),
    0,
  );
  const bookedInrProfit = sales.reduce(
    (s, r) => s + (r.bookedProfitInr ?? (r.bookedCurrency === 'INR' ? r.bookedProfit ?? 0 : 0)),
    0,
  );

  return {
    purchaseCount: purchases.length,
    saleCount: sales.length,
    purchaseUnits: roundQty(purchaseUnits),
    saleUnits: roundQty(saleUnits),
    purchaseAed: money(purchaseAed),
    saleAed: money(saleAed),
    purchaseInr: money(purchaseInr),
    saleInr: money(saleInr),
    metalWeightPurchasedG: roundQty(metalWeightPurchasedG),
    metalWeightSoldG: roundQty(metalWeightSoldG),
    bookedInrProfit: money(bookedInrProfit),
    bookedAedProfit: money(bookedAedProfit),
  };
}

export function isMetalAgentAedLine(row: ICSettlementTradeLine): boolean {
  return (
    row.metalPaymentMethod === 'AED' ||
    row.metalPaymentMethod === 'SPLIT' ||
    isMetalAedPayment(row.metalPaymentMethod) ||
    isMetalSplitPayment(row.metalPaymentMethod)
  );
}

export function isMetalCashInrLine(row: ICSettlementTradeLine): boolean {
  return (
    row.metalPaymentMethod !== 'AED' &&
    !isMetalAedPayment(row.metalPaymentMethod)
  );
}

export type MetalRegisterBook = 'inr' | 'aed';

export function sliceSettlementTradeReport(
  report: ICSettlementTradeReport,
  book: MetalRegisterBook,
): ICSettlementTradeReport {
  if (report.settlementMode !== 'metal') return report;
  const keep = book === 'aed' ? isMetalAgentAedLine : isMetalCashInrLine;
  const sliceAmounts = (row: ICSettlementTradeLine): ICSettlementTradeLine => {
    if (row.metalPaymentMethod !== 'SPLIT') return row;
    if (book === 'aed') {
      const paid = Number(row.splitAedPaid) || 0;
      return { ...row, aedTotal: paid, inrTotal: 0, splitInrPaid: 0, splitAedPaid: paid };
    }
    const paid = Number(row.splitInrPaid) || 0;
    return { ...row, inrTotal: paid, aedTotal: 0, splitInrPaid: paid, splitAedPaid: 0 };
  };
  const purchases = report.purchases.filter(keep).map(sliceAmounts);
  const sales = report.sales.filter(keep).map(sliceAmounts);
  return {
    ...report,
    purchases,
    sales,
    summary: summarizeSettlementTrades(purchases, sales),
  };
}

export function settlementTradeReportTitle(mode: ICSettlementMode): string {
  return mode === 'metal' ? 'Metal purchase & sales register' : 'Fund purchase & sales register';
}

export function settlementTradeReportSubtitle(mode: ICSettlementMode): string {
  return mode === 'metal'
    ? 'Metal in grams. Cash metal is rupees; AED agent is cash with the agent — not metal profit.'
    : 'Cash IC in AED — units, rates, and amounts. Not metal.';
}
