import {
  computeIcCashAedTotal,
  displayIcSheetRateFromPoolInternalWac,
  INR_PER_UNIT,
} from '@/lib/icTransfer/rateCalculations';
import { isMetalAedPayment } from '@/lib/domain/books';
import { isDateInRange, type DateFilterRange } from '@/lib/dateFilterRange';
import { isVoidIcSaleOrderStatus } from '@/lib/icFunds/icTransferReportFilters';
import { computeMetalLotProfit } from '@/lib/icTransfer/metalInventory';
import {
  allocateMetalLotCostAed,
  allocateMetalLotCostInr,
} from '@/lib/icTransfer/metalLotCost';
import { resolveSaleInrDisplay } from '@/lib/icTransfer/metalSettlement';
import {
  remainingStockWac,
  simulateWarehouseInventory,
  type WarehouseInventoryEvent,
} from '@/lib/icFunds/warehouseProfit';
import type { ICPurchase, ICSale } from '@/types';

export type DealProfitSlice = {
  cashGrossProfitAed: number;
  /** IC cash gross profit in implied INR (margin AED × INR-notional ÷ sale revenue AED per sale). */
  cashGrossProfitInr: number;
  cashRevenueAed: number;
  cashCogsAed: number;
  cashSaleUnits: number;
  metalProfitAed: number;
  metalProfitInr: number;
  metalSoldG: number;
  metalSaleCount: number;
};

const EMPTY: DealProfitSlice = {
  cashGrossProfitAed: 0,
  cashGrossProfitInr: 0,
  cashRevenueAed: 0,
  cashCogsAed: 0,
  cashSaleUnits: 0,
  metalProfitAed: 0,
  metalProfitInr: 0,
  metalSoldG: 0,
  metalSaleCount: 0,
};

function round2(n: number): number {
  return Number((Number.isFinite(n) ? n : 0).toFixed(2));
}

function round4(n: number): number {
  return Number((Number.isFinite(n) ? n : 0).toFixed(4));
}

function isMetal(mode: string | undefined | null): boolean {
  return mode === 'metal';
}

/** Metal sold for INR becomes IC units (₹1 lakh = 1 unit). Agent-AED metal stays off the IC pool. */
function metalInrSaleIcUnits(sale: ICSale): number {
  if (!isMetal(sale.settlementMode) || isMetalAedPayment(sale.metalPaymentMethod)) return 0;
  return Number(sale.units) || 0;
}

function icStockPurchaseEvents(
  purchases: ICPurchase[],
  throughIso?: (iso: string | undefined) => boolean,
): WarehouseInventoryEvent[] {
  const events: WarehouseInventoryEvent[] = [];
  for (const p of purchases) {
    if (isMetal(p.settlementMode)) continue;
    if (throughIso && !throughIso(p.createdAt)) continue;
    const units = Number(p.units) || 0;
    if (units <= 0) continue;
    events.push({
      kind: 'purchase',
      at: purchaseMs(p),
      sortKey: p.id,
      units,
      cost:
        Number(p.aedTotal) ||
        computeIcCashAedTotal(units, Number(p.unitRate) || 0),
    });
  }
  return events;
}

/**
 * AED cost for the **IC unit pool** from a metal·INR completed sale.
 * Same as cash IC: **units × sheet RATE × 100** = customer metal AED (INR × R ÷ 1000).
 * When only `aedAmount` is present, use full booked AED (legacy or explicit).
 */
function metalInrIcPoolCostAed(sale: ICSale, units: number): number {
  const u = Number(units);
  const rate = Number(sale.unitRate) || 0;
  if (u > 0 && rate > 0) return computeIcCashAedTotal(u, rate);
  const aed = Number(sale.aedAmount) || 0;
  if (aed > 0) return Number(aed.toFixed(4));
  return 0;
}

function icStockInflowFromMetalInrSales(
  sales: ICSale[],
  throughIso?: (iso: string | undefined) => boolean,
): WarehouseInventoryEvent[] {
  const events: WarehouseInventoryEvent[] = [];
  for (const s of sales) {
    const units = metalInrSaleIcUnits(s);
    if (units <= 0) continue;
    if (throughIso && !throughIso(s.statusUpdatedAt || s.createdAt)) continue;
    events.push({
      kind: 'purchase',
      at: saleMs(s),
      sortKey: `metal-inr-${s.id}`,
      units,
      cost: metalInrIcPoolCostAed(s, units),
    });
  }
  return events;
}

function icStockSaleEvents(
  sales: ICSale[],
  throughIso?: (iso: string | undefined) => boolean,
): WarehouseInventoryEvent[] {
  const events: WarehouseInventoryEvent[] = [];
  for (const s of sales) {
    if (isMetal(s.settlementMode)) continue;
    if (throughIso && !throughIso(s.createdAt)) continue;
    const units = Number(s.units) || 0;
    if (units <= 0) continue;
    events.push({
      kind: 'sale',
      at: saleMs(s),
      sortKey: s.id,
      saleId: s.id,
      units,
      collectedUnits: s.collectedUnits,
      unitRate: Number(s.unitRate) || 0,
      aedAmount: Number(s.aedAmount) || 0,
      serviceCharge: Number(s.serviceCharge) || 0,
    });
  }
  return events;
}

/** Pending/null still count — fulfillment queues are retired. Only rejected/cancelled drop out. */
export function isDealSaleActive(sale: Pick<ICSale, 'orderStatus'>): boolean {
  const status = sale.orderStatus;
  if (!status || status === 'pending' || status === 'accepted' || status === 'unknown') return true;
  if (status === 'completed' || status === 'wh_processing' || status === 'delivery_pending_admin') {
    return true;
  }
  return !isVoidIcSaleOrderStatus(status);
}

function inRange(iso: string | undefined, range: DateFilterRange): boolean {
  if (!range.startDate && !range.endDate) return true;
  if (!iso) return false;
  return isDateInRange(iso.slice(0, 10), range);
}

function throughEnd(iso: string | undefined, range: DateFilterRange): boolean {
  if (!range.endDate || !iso) return true;
  return iso.slice(0, 10) <= range.endDate;
}

function saleMs(sale: ICSale): number {
  const raw = sale.statusUpdatedAt || sale.createdAt || '';
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

function purchaseMs(purchase: ICPurchase): number {
  const t = new Date(purchase.createdAt || '').getTime();
  return Number.isFinite(t) ? t : 0;
}

export function emptyDealProfit(): DealProfitSlice {
  return { ...EMPTY };
}

export function sumDealProfit(slices: DealProfitSlice[]): DealProfitSlice {
  return slices.reduce(
    (acc, s) => ({
      cashGrossProfitAed: round2(acc.cashGrossProfitAed + s.cashGrossProfitAed),
      cashGrossProfitInr: round2(acc.cashGrossProfitInr + s.cashGrossProfitInr),
      cashRevenueAed: round2(acc.cashRevenueAed + s.cashRevenueAed),
      cashCogsAed: round2(acc.cashCogsAed + s.cashCogsAed),
      cashSaleUnits: round4(acc.cashSaleUnits + s.cashSaleUnits),
      metalProfitAed: round2(acc.metalProfitAed + s.metalProfitAed),
      metalProfitInr: round2(acc.metalProfitInr + s.metalProfitInr),
      metalSoldG: round4(acc.metalSoldG + s.metalSoldG),
      metalSaleCount: acc.metalSaleCount + s.metalSaleCount,
    }),
    emptyDealProfit(),
  );
}

export function computeDealProfit(options: {
  purchases: ICPurchase[];
  sales: ICSale[];
  range: DateFilterRange;
  warehouseId?: string;
}): DealProfitSlice {
  const { purchases, sales, range, warehouseId } = options;
  const scopedPurchases = warehouseId
    ? purchases.filter(p => p.warehouseId === warehouseId)
    : purchases;
  const scopedSales = warehouseId
    ? sales.filter(s => s.warehouseId === warehouseId)
    : sales;

  const warehouseIds = new Set<string>();
  for (const p of scopedPurchases) {
    if (p.warehouseId) warehouseIds.add(p.warehouseId);
  }
  for (const s of scopedSales) {
    if (s.warehouseId) warehouseIds.add(s.warehouseId);
  }

  const slices: DealProfitSlice[] = [];
  for (const id of warehouseIds) {
    slices.push(computeOneWarehouse(id, scopedPurchases, scopedSales, range));
  }
  return sumDealProfit(slices);
}

function computeOneWarehouse(
  warehouseId: string,
  purchases: ICPurchase[],
  sales: ICSale[],
  range: DateFilterRange,
): DealProfitSlice {
  const whPurchases = purchases.filter(p => p.warehouseId === warehouseId);
  const whSales = sales.filter(s => s.warehouseId === warehouseId && isDealSaleActive(s));

  const through = (iso: string | undefined) => throughEnd(iso, range);
  const events: WarehouseInventoryEvent[] = [
    ...icStockPurchaseEvents(whPurchases, through),
    ...icStockInflowFromMetalInrSales(whSales, through),
    ...icStockSaleEvents(whSales, through),
  ];

  const cashSalesInPeriod = whSales.filter(
    s => !isMetal(s.settlementMode) && inRange(s.createdAt, range),
  );

  const { saleMargins } = simulateWarehouseInventory(events);
  let cashGrossProfitAed = 0;
  let cashGrossProfitInr = 0;
  let cashRevenueAed = 0;
  let cashCogsAed = 0;
  let cashSaleUnits = 0;
  for (const s of cashSalesInPeriod) {
    const margin = saleMargins.get(s.id);
    if (!margin) continue;
    cashGrossProfitAed += margin.grossProfit;
    cashRevenueAed += margin.revenue;
    cashCogsAed += margin.cogs;
    cashSaleUnits += margin.deliveredUnits;
    const units = Number(s.units) || 0;
    const rev = margin.revenue;
    if (rev > 0 && units > 0) {
      const inrNotional = units * INR_PER_UNIT;
      cashGrossProfitInr += margin.grossProfit * (inrNotional / rev);
    }
  }

  const lots = new Map(whPurchases.filter(p => isMetal(p.settlementMode)).map(p => [p.id, p]));
  let metalProfitAed = 0;
  let metalProfitInr = 0;
  let metalSoldG = 0;
  let metalSaleCount = 0;
  for (const s of whSales) {
    if (!isMetal(s.settlementMode)) continue;
    if (String(s.orderStatus || '') !== 'completed') continue;
    const saleIso = s.statusUpdatedAt || s.createdAt;
    if (!inRange(saleIso, range)) continue;
    const lot = s.metalPurchaseId ? lots.get(s.metalPurchaseId) : undefined;
    const saleG = Number(s.metalWeightG) || 0;
    const pl = computeMetalLotProfit({
      paymentMethod: s.metalPaymentMethod,
      purchasePaymentMethod: lot?.metalPaymentMethod ?? s.metalPaymentMethod,
      weightG: saleG,
      purchaseInr: allocateMetalLotCostInr(lot, saleG),
      purchaseAed: allocateMetalLotCostAed(lot, saleG),
      saleInr: resolveSaleInrDisplay(s),
      saleAed: Number(s.aedAmount) || 0,
    });
    metalProfitAed += Number(pl.bookedProfitAed) || 0;
    metalProfitInr += Number(pl.bookedProfitInr) || 0;
    metalSoldG += saleG;
    metalSaleCount += 1;
  }

  return {
    cashGrossProfitAed: round2(cashGrossProfitAed),
    cashGrossProfitInr: round2(cashGrossProfitInr),
    cashRevenueAed: round2(cashRevenueAed),
    cashCogsAed: round2(cashCogsAed),
    cashSaleUnits: round4(cashSaleUnits),
    metalProfitAed: round2(metalProfitAed),
    metalProfitInr: round2(metalProfitInr),
    metalSoldG: round4(metalSoldG),
    metalSaleCount,
  };
}

/**
 * Remaining IC WAC: cash IC purchases + metal INR sales (₹1 lakh = 1 unit),
 * minus cash IC sales. Agent-AED metal never enters this pool.
 */
export function remainingIcStockWac(
  purchases: ICPurchase[],
  sales: ICSale[],
  warehouseId: string,
): { units: number; rate: number } {
  const whPurchases = purchases.filter(p => p.warehouseId === warehouseId);
  const whSales = sales.filter(s => s.warehouseId === warehouseId && isDealSaleActive(s));
  const events: WarehouseInventoryEvent[] = [
    ...icStockPurchaseEvents(whPurchases),
    ...icStockInflowFromMetalInrSales(whSales),
    ...icStockSaleEvents(whSales),
  ];
  const { pool } = simulateWarehouseInventory(events);
  return {
    units: pool.units,
    rate: displayIcSheetRateFromPoolInternalWac(remainingStockWac(pool)),
  };
}
