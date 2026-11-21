import { roundMoney } from '@/lib/icFunds/currencyPolicy';
import { isMetalAedPayment } from '@/lib/domain/books';
import { bookedMetalAed, bookedMetalInr } from '@/lib/icTransfer/metalSplit';
import { isDateInRange, type DateFilterRange } from '@/lib/dateFilterRange';
import type { LedgerFlowSnapshot } from '@/lib/icFunds/ledgerKpiMetrics';
import { netMetalInr } from '@/lib/icTransfer/labTest';
import { allocateMetalLotCostInr } from '@/lib/icTransfer/metalLotCost';
import type { ICPurchase, ICSale } from '@/types';

export type DealBookPair = {
  aed: LedgerFlowSnapshot;
  inr: LedgerFlowSnapshot;
};

function txnDate(createdAt?: string): string | null {
  if (!createdAt) return null;
  return createdAt.slice(0, 10);
}

function beforeRange(date: string | null, range: DateFilterRange): boolean {
  if (!range.startDate) return false;
  if (!date) return false;
  return date < range.startDate;
}

function inRange(date: string | null, range: DateFilterRange): boolean {
  if (!date) return !range.startDate && !range.endDate;
  return isDateInRange(date, range);
}

/** Metal + AED agent: stored AED was fixed to gross INR; scale down by lab using the same INR/AED sheet. */
function metalAgentAedNetOfLab(
  storedAed: number,
  grossInr?: number | null,
  labTotalInr?: number | null,
): number {
  const gross = Number(grossInr) || 0;
  const aed = Number(storedAed) || 0;
  if (aed <= 0 || gross <= 0) return aed;
  const netInr = netMetalInr(gross, Number(labTotalInr) || 0);
  return roundMoney((aed * netInr) / gross);
}

/** AED cash IC + metal paid via AED agent / split AED leg. Cash-metal AED is ignored. */
export function dealPurchaseAed(p: ICPurchase): number {
  if (p.settlementMode !== 'metal') return Number(p.aedTotal) || 0;
  if (isMetalAedPayment(p.metalPaymentMethod)) {
    return metalAgentAedNetOfLab(Number(p.aedTotal) || 0, p.inrTotal, p.labTotalInr);
  }
  return bookedMetalAed({
    paymentMethod: p.metalPaymentMethod,
    aedTotal: p.aedTotal,
    splitAedPaid: p.splitAedPaid,
  });
}

/** Cash-metal / split INR payable only (net of lab). AED-agent metal INR is a rate memo, not a liability. */
export function dealPurchaseInr(p: ICPurchase): number {
  if (p.settlementMode !== 'metal') return 0;
  return bookedMetalInr({
    paymentMethod: p.metalPaymentMethod,
    inrTotal: p.inrTotal,
    labTotalInr: p.labTotalInr,
    splitInrPaid: p.splitInrPaid,
  });
}

export function dealSaleAed(s: ICSale): number {
  const raw = (Number(s.aedAmount) || 0) + (Number(s.serviceCharge) || 0);
  if (s.settlementMode !== 'metal') return raw;
  if (isMetalAedPayment(s.metalPaymentMethod)) {
    return metalAgentAedNetOfLab(raw, s.inrTotal, s.labTotalInr);
  }
  return bookedMetalAed({
    paymentMethod: s.metalPaymentMethod,
    aedTotal: raw,
    splitAedPaid: s.splitAedPaid,
  });
}

export function dealSaleInr(s: ICSale): number {
  if (s.settlementMode !== 'metal') return 0;
  return bookedMetalInr({
    paymentMethod: s.metalPaymentMethod,
    inrTotal: s.inrTotal,
    labTotalInr: s.labTotalInr,
    splitInrPaid: s.splitInrPaid,
  });
}

function buildCombinedBookSnapshot(
  purchaseRows: { aed: number; inr: number; date: string | null }[],
  saleRows: { aed: number; inr: number; date: string | null }[],
  range: DateFilterRange,
  pick: 'aed' | 'inr',
): LedgerFlowSnapshot {
  let openingPurch = 0;
  let openingSale = 0;
  let periodDr = 0;
  let periodCr = 0;

  for (const row of purchaseRows) {
    const amount = pick === 'aed' ? row.aed : row.inr;
    if (beforeRange(row.date, range)) openingPurch += amount;
    else if (inRange(row.date, range)) periodDr += amount;
  }
  for (const row of saleRows) {
    const amount = pick === 'aed' ? row.aed : row.inr;
    if (beforeRange(row.date, range)) openingSale += amount;
    else if (inRange(row.date, range)) periodCr += amount;
  }

  const opening = openingPurch - openingSale;
  const closing = opening + periodDr - periodCr;
  return {
    opening: round2(opening),
    periodDebit: round2(periodDr),
    periodCredit: round2(periodCr),
    closing: round2(closing),
  };
}

function txnOnOrBefore(date: string | null, endDate?: string | null): boolean {
  if (!date) return false;
  if (!endDate) return true;
  return date <= endDate;
}

function isCompletedMetalSale(s: ICSale): boolean {
  return s.settlementMode === 'metal' && String(s.orderStatus || '') === 'completed';
}

/** Unsold cash-metal lots at net INR cost. AED lots never entered Metal Stock. */
export function remainingCashMetalInrCost(
  purchases: ICPurchase[],
  sales: ICSale[],
  cutoff: { before?: string | null; through?: string | null },
): number {
  const include = (date: string | null): boolean => {
    if (!date) return false;
    if (cutoff.before) return date < cutoff.before;
    return txnOnOrBefore(date, cutoff.through);
  };

  let total = 0;
  for (const p of purchases) {
    if (p.settlementMode !== 'metal' || isMetalAedPayment(p.metalPaymentMethod)) continue;
    if (!include(txnDate(p.createdAt))) continue;
    const net = netMetalInr(Number(p.inrTotal) || 0, Number(p.labTotalInr) || 0);
    if (net <= 0) continue;
    const soldG = sales.reduce((sum, s) => {
      if (!isCompletedMetalSale(s)) return sum;
      if (String(s.metalPurchaseId || '') !== String(p.id)) return sum;
      if (!include(txnDate(s.createdAt))) return sum;
      return sum + (Number(s.metalWeightG) || 0);
    }, 0);
    const consumed = allocateMetalLotCostInr(
      {
        inrTotal: p.inrTotal,
        metalWeightG: p.metalWeightG,
        labTotalInr: p.labTotalInr,
      },
      soldG,
    );
    total += Math.max(0, net - consumed);
  }
  return round2(total);
}

function buildBookSnapshot(
  rows: { aed: number; inr: number; date: string | null }[],
  range: DateFilterRange,
  flow: 'purchase' | 'sale',
  pick: 'aed' | 'inr',
): LedgerFlowSnapshot {
  let opening = 0;
  let period = 0;

  for (const row of rows) {
    const amount = pick === 'aed' ? row.aed : row.inr;
    if (beforeRange(row.date, range)) opening += amount;
    else if (inRange(row.date, range)) period += amount;
  }

  if (flow === 'purchase') {
    const closing = opening + period;
    return {
      opening: round2(opening),
      periodDebit: round2(period),
      periodCredit: 0,
      closing: round2(closing),
    };
  }

  const closing = opening + period;
  return {
    opening: round2(opening),
    periodDebit: 0,
    periodCredit: round2(period),
    closing: round2(closing),
  };
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

function mapPurchases(purchases: ICPurchase[]) {
  return purchases.map(p => ({
    aed: dealPurchaseAed(p),
    inr: dealPurchaseInr(p),
    date: txnDate(p.createdAt),
  }));
}

function mapSales(sales: ICSale[]) {
  return sales.map(s => ({
    aed: dealSaleAed(s),
    inr: dealSaleInr(s),
    date: txnDate(s.createdAt),
  }));
}

export function computePurchaseBookKpis(purchases: ICPurchase[], range: DateFilterRange): DealBookPair {
  const rows = mapPurchases(purchases);
  return {
    aed: buildBookSnapshot(rows, range, 'purchase', 'aed'),
    inr: buildBookSnapshot(rows, range, 'purchase', 'inr'),
  };
}

export function computeSaleBookKpis(sales: ICSale[], range: DateFilterRange): DealBookPair {
  const rows = mapSales(sales);
  return {
    aed: buildBookSnapshot(rows, range, 'sale', 'aed'),
    inr: buildBookSnapshot(rows, range, 'sale', 'inr'),
  };
}

/**
 * Purchases (Dr) and sales (Cr) on one AED + INR strip — for warehouse / dashboard.
 * Closing = opening + Dr − Cr (ledger balance). Matched round-trip with zero opening:
 * closing is negative when sale AED exceeds purchase AED — same magnitude as cash P&L, Cr side.
 */
export function computeCombinedTradeBookKpis(
  purchases: ICPurchase[],
  sales: ICSale[],
  range: DateFilterRange,
  openingBalances: { aed?: number; inr?: number } = {},
): DealBookPair {
  const pRows = mapPurchases(purchases);
  const sRows = mapSales(sales);
  const inrFlow = buildCombinedBookSnapshot(pRows, sRows, range, 'inr');
  return {
    aed: (() => {
      const flow = buildCombinedBookSnapshot(pRows, sRows, range, 'aed');
      const opening = (Number(openingBalances.aed) || 0) + flow.opening;
      return { ...flow, opening: round2(opening), closing: round2(opening + flow.periodDebit - flow.periodCredit) };
    })(),
    inr: {
      ...inrFlow,
      opening: range.startDate
        ? (Number(openingBalances.inr) || 0) + remainingCashMetalInrCost(purchases, sales, { before: range.startDate })
        : Number(openingBalances.inr) || 0,
      closing: (Number(openingBalances.inr) || 0) + remainingCashMetalInrCost(purchases, sales, { through: range.endDate }),
    },
  };
}

export function countPurchasesInRange(purchases: ICPurchase[], range: DateFilterRange): { cash: number; metal: number } {
  let cash = 0;
  let metal = 0;
  for (const p of purchases) {
    if (!inRange(txnDate(p.createdAt), range)) continue;
    if (p.settlementMode === 'metal') metal += 1;
    else cash += 1;
  }
  return { cash, metal };
}

export function countSalesInRange(sales: ICSale[], range: DateFilterRange): { cash: number; metal: number } {
  let cash = 0;
  let metal = 0;
  for (const s of sales) {
    if (!inRange(txnDate(s.createdAt), range)) continue;
    if (s.settlementMode === 'metal') metal += 1;
    else cash += 1;
  }
  return { cash, metal };
}
