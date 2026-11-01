import type { ICSettlementMode } from '@/lib/icTransfer/metalSettlement';

export type ICSettlementTradeLine = {
  id: string;
  txnKind: 'purchase' | 'sale';
  date: string;
  reference: string;
  counterparty: string;
  counterpartyCode?: string;
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
  metalPaymentMethod?: 'INR' | 'AED';
  bookedProfit?: number;
  bookedCurrency?: 'AED';
  paymentMethod?: string;
  paymentStatus?: string;
  orderStatus?: string;
  notes?: string;
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

function round2(n: number): number {
  return Number((Number.isFinite(n) ? n : 0).toFixed(2));
}

function round4(n: number): number {
  return Number((Number.isFinite(n) ? n : 0).toFixed(4));
}

/** Imputed AED/unit when legacy rows omit unit_rate (common on metal settlement). */
export function resolveTradeUnitRateAed(units: number, unitRate: number, aedTotal: number): number {
  const rate = Number(unitRate);
  if (Number.isFinite(rate) && rate > 0) return round4(rate);
  const u = Number(units);
  const aed = Number(aedTotal);
  if (Number.isFinite(u) && u > 0 && Number.isFinite(aed) && aed > 0) {
    return round4(aed / u);
  }
  return 0;
}

export function summarizeSettlementTrades(
  purchases: ICSettlementTradeLine[],
  sales: ICSettlementTradeLine[],
): ICSettlementTradeSummary {
  const purchaseUnits = purchases.reduce((s, r) => s + r.units, 0);
  const saleUnits = sales.reduce((s, r) => s + r.units, 0);
  const purchaseAed = purchases.reduce((s, r) => s + r.aedTotal, 0);
  const saleAed = sales.reduce((s, r) => s + r.aedTotal, 0);
  const purchaseInr = purchases.reduce((s, r) => s + (r.inrTotal ?? 0), 0);
  const saleInr = sales.reduce((s, r) => s + (r.inrTotal ?? 0), 0);
  const metalWeightPurchasedG = purchases.reduce((s, r) => s + (r.metalWeightG ?? 0), 0);
  const metalWeightSoldG = sales.reduce((s, r) => s + (r.metalWeightG ?? 0), 0);
  const bookedAedProfit = sales.reduce((s, r) => s + (r.bookedProfit ?? 0), 0);

  return {
    purchaseCount: purchases.length,
    saleCount: sales.length,
    purchaseUnits: round4(purchaseUnits),
    saleUnits: round4(saleUnits),
    purchaseAed: round2(purchaseAed),
    saleAed: round2(saleAed),
    purchaseInr: round2(purchaseInr),
    saleInr: round2(saleInr),
    metalWeightPurchasedG: round4(metalWeightPurchasedG),
    metalWeightSoldG: round4(metalWeightSoldG),
    bookedInrProfit: 0,
    bookedAedProfit: round2(bookedAedProfit),
  };
}

export function settlementTradeReportTitle(mode: ICSettlementMode): string {
  return mode === 'metal' ? 'Metal purchase & sales register' : 'Fund purchase & sales register';
}

export function settlementTradeReportSubtitle(mode: ICSettlementMode): string {
  return mode === 'metal'
    ? 'Metal lots in grams. P&L (AED) = sale total AED − purchase total AED on the lot.'
    : 'Cash (AED fund) IC purchases and sales — units, rates, and ledger amounts.';
}
