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
  saleId: string;
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
};

export type ICWarehousePLWarehouseSummary = {
  warehouseId: string;
  warehouseName: string;
  purchaseUnits: number;
  purchaseCost: number;
  weightedAvgRate: number;
  saleUnits: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
};

export type ICWarehousePLReport = {
  lines: ICWarehousePLLine[];
  warehouses: ICWarehousePLWarehouseSummary[];
  totals: {
    saleUnits: number;
    revenue: number;
    cogs: number;
    grossProfit: number;
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
  return units * unitRate;
}

/** Weighted average on a cost pool (remaining stock or all-time purchases). */
export function weightedAveragePurchaseRate(pool: WarehousePurchasePool): number {
  if (pool.totalUnits <= 0) return 0;
  return pool.totalCost / pool.totalUnits;
}

export function remainingStockWac(pool: RemainingStockPool): number {
  if (pool.units <= 0) return 0;
  return pool.cost / pool.units;
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
