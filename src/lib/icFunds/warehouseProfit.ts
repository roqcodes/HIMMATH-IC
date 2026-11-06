import { computeIcCashAedTotal } from '@/lib/icTransfer/rateCalculations';
import { getDeliveredUnits } from '@/lib/icTransfer/saleUnits';

export type WarehousePurchasePool = {
  totalUnits: number;
  totalCost: number;
};

export type RemainingStockPool = {
  units: number;
  cost: number;
};

export type WarehouseInventoryPurchase = {
  kind: 'purchase';
  at: number;
  sortKey: string;
  units: number;
  cost: number;
};

export type WarehouseInventorySale = {
  kind: 'sale';
  at: number;
  sortKey: string;
  saleId: string;
  units: number;
  collectedUnits?: number | null;
  unitRate: number;
  aedAmount: number;
  serviceCharge: number;
};

export type WarehouseInventoryEvent = WarehouseInventoryPurchase | WarehouseInventorySale;

export type SaleMarginInput = {
  units: number;
  collectedUnits?: number | null;
  orderStatus: string;
  unitRate: number;
  aedAmount: number;
  serviceCharge: number;
};

export type SaleMarginResult = {
  deliveredUnits: number;
  revenue: number;
  saleRate: number;
  avgPurchaseRate: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
};

export type ICWarehousePLLine = {
  lineKind: 'sale' | 'metal_purchase';
  /** Sale UUID, or metal-purchase UUID when lineKind is metal_purchase (stable row id for exports/filters). */
  saleId: string;
  /** Epoch ms for ordering detail rows on the same calendar day. */
  eventAtMs: number;
  saleDate: string;
  warehouseId: string;
  warehouseName: string;
  customerName: string;
  units: number;
  saleRate: number;
  revenue: number;
  avgPurchaseRate: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
  settlementMode: 'cash' | 'metal';
  metalWeightG?: number;
  bookedCurrency?: 'AED' | 'INR';
  /** Sale id when lineKind is sale; purchase id when lineKind is metal_purchase. */
  referenceId?: string;
  /**
   * Metal tab (INR detail): economic INR amounts regardless of agent/AED booking.
   * Purchase rows: revenue 0, cost = net INR for the lot, profit 0.
   * Sale rows: sale INR, lot cost INR, and INR P&amp;L (sale − cost).
   */
  metalDisplayRevenueInr?: number;
  metalDisplayCostInr?: number;
  metalDisplayProfitInr?: number;
};

export type ICWarehousePLWarehouseSummary = {
  warehouseId: string;
  warehouseName: string;
  openingUnits: number;
  unitsIn: number;
  unitsOut: number;
  closingUnits: number;
  openingMetalG: number;
  metalInG: number;
  metalOutG: number;
  closingMetalG: number;
  purchaseUnits: number;
  purchaseCost: number;
  weightedAvgRate: number;
  saleUnits: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  metalProfitAed: number;
  metalProfitInr: number;
  metalSoldG: number;
};

export type ICWarehousePLReport = {
  lines: ICWarehousePLLine[];
  warehouses: ICWarehousePLWarehouseSummary[];
  totals: {
    saleUnits: number;
    revenue: number;
    cogs: number;
    grossProfit: number;
    metalProfitAed: number;
    metalProfitInr: number;
    metalSoldG: number;
  };
};

function round2(value: number): number {
  return Number(value.toFixed(2));
}

export function purchaseAedTotal(
  units: number,
  unitRate: number,
  aedTotal?: number | null,
): number {
  if (aedTotal != null && Number.isFinite(Number(aedTotal))) return Number(aedTotal);
  return computeIcCashAedTotal(units, unitRate);
}

/** Weighted average on a cost pool (remaining stock or all-time purchases). */
export function weightedAveragePurchaseRate(pool: WarehousePurchasePool): number {
  if (pool.totalUnits <= 0) return 0;
  return pool.totalCost / pool.totalUnits;
}

export function remainingStockWac(pool: RemainingStockPool): number {
  const u = Number(pool.units);
  if (!Number.isFinite(u) || Math.abs(u) < 1e-9) return 0;
  return pool.cost / u;
}

export function addPurchaseToPool(pool: RemainingStockPool, units: number, cost: number): void {
  pool.units += units;
  pool.cost += cost;
}

/** Deplete remaining stock at current WAC (perpetual inventory). */
export function consumeSaleFromPool(pool: RemainingStockPool, units: number): void {
  const rate = remainingStockWac(pool);
  pool.cost -= units * rate;
  pool.units -= units;
}

export function compareInventoryEvents(
  a: WarehouseInventoryEvent,
  b: WarehouseInventoryEvent,
): number {
  if (a.at !== b.at) return a.at - b.at;
  if (a.kind !== b.kind) return a.kind === 'purchase' ? -1 : 1;
  return a.sortKey.localeCompare(b.sortKey);
}

export function computeSaleMargin(
  sale: SaleMarginInput,
  pool: WarehousePurchasePool,
): SaleMarginResult {
  const deliveredUnits = getDeliveredUnits(sale.units, sale.collectedUnits, sale.orderStatus);
  const revenue = (Number(sale.aedAmount) || 0) + (Number(sale.serviceCharge) || 0);
  const avgPurchaseRate = weightedAveragePurchaseRate(pool);
  const cogs = round2(deliveredUnits * avgPurchaseRate);
  const grossProfit = round2(revenue - cogs);
  const saleRate =
    deliveredUnits > 0 ? round2(revenue / deliveredUnits) : Number(sale.unitRate) || 0;
  const marginPct = revenue > 0 ? round2((grossProfit / revenue) * 100) : 0;

  return {
    deliveredUnits,
    revenue,
    saleRate,
    avgPurchaseRate: round2(avgPurchaseRate),
    cogs,
    grossProfit,
    marginPct,
  };
}

/** Replay purchases and completed sales; margin uses WAC on remaining stock before each sale. */
export function simulateWarehouseInventory(events: WarehouseInventoryEvent[]): {
  pool: RemainingStockPool;
  saleMargins: Map<string, SaleMarginResult>;
} {
  const pool: RemainingStockPool = { units: 0, cost: 0 };
  const saleMargins = new Map<string, SaleMarginResult>();
  const sorted = [...events].sort(compareInventoryEvents);

  for (const event of sorted) {
    if (event.kind === 'purchase') {
      addPurchaseToPool(pool, event.units, event.cost);
      continue;
    }

    const margin = computeSaleMargin(
      {
        units: event.units,
        collectedUnits: event.collectedUnits,
        orderStatus: 'completed',
        unitRate: event.unitRate,
        aedAmount: event.aedAmount,
        serviceCharge: event.serviceCharge,
      },
      { totalUnits: pool.units, totalCost: pool.cost },
    );
    saleMargins.set(event.saleId, margin);
    consumeSaleFromPool(pool, margin.deliveredUnits);
  }

  return { pool, saleMargins };
}

export function resolveSaleMarginFromPool(
  sale: SaleMarginInput,
  pool: RemainingStockPool,
): SaleMarginResult {
  return computeSaleMargin(sale, { totalUnits: pool.units, totalCost: pool.cost });
}

export function icUnitStockAt(events: WarehouseInventoryEvent[], beforeMs: number | null): number {
  if (beforeMs == null) return 0;
  const filtered = events.filter(e => e.at < beforeMs);
  if (filtered.length === 0) return 0;
  return simulateWarehouseInventory(filtered).pool.units;
}

export function icUnitStockThrough(events: WarehouseInventoryEvent[], throughMs: number | null): number {
  const filtered = throughMs == null ? events : events.filter(e => e.at <= throughMs);
  if (filtered.length === 0) return 0;
  return simulateWarehouseInventory(filtered).pool.units;
}

export function sumIcUnitsInPeriod(
  events: WarehouseInventoryEvent[],
  periodStartMs: number | null,
  periodEndMs: number | null,
): { unitsIn: number; unitsOut: number } {
  let unitsIn = 0;
  let unitsOut = 0;
  for (const event of events) {
    if (periodStartMs != null && event.at < periodStartMs) continue;
    if (periodEndMs != null && event.at > periodEndMs) continue;
    if (event.kind === 'purchase') {
      unitsIn += event.units;
    } else {
      unitsOut += getDeliveredUnits(event.units, event.collectedUnits, 'completed');
    }
  }
  return { unitsIn, unitsOut };
}

export type MetalWeightEvent = { at: number; grams: number };

export function metalStockAt(events: MetalWeightEvent[], beforeMs: number | null): number {
  if (beforeMs == null) return 0;
  return events.filter(e => e.at < beforeMs).reduce((s, e) => s + e.grams, 0);
}

export function metalMovementInPeriod(
  events: MetalWeightEvent[],
  periodStartMs: number | null,
  periodEndMs: number | null,
): { metalInG: number; metalOutG: number } {
  let metalInG = 0;
  let metalOutG = 0;
  for (const event of events) {
    if (periodStartMs != null && event.at < periodStartMs) continue;
    if (periodEndMs != null && event.at > periodEndMs) continue;
    if (event.grams > 0) metalInG += event.grams;
    else if (event.grams < 0) metalOutG += Math.abs(event.grams);
  }
  return { metalInG, metalOutG };
}

export function metalStockThrough(events: MetalWeightEvent[], throughMs: number | null): number {
  const filtered = throughMs == null ? events : events.filter(e => e.at <= throughMs);
  return filtered.reduce((s, e) => s + e.grams, 0);
}
