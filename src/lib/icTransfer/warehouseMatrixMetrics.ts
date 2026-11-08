import { isDateInRange, type DateFilterRange } from '@/lib/dateFilterRange';
import { computeDealProfit } from '@/lib/icTransfer/dealProfit';
import { computeWarehouseIcStockWac, computeWarehouseIcUnitsOnHand } from '@/lib/icTransfer/warehouseIcStock';
import { dealPurchaseAed, dealSaleAed, remainingCashMetalInrCost } from '@/lib/icTransfer/dealBookKpis';
import { resolvePurchaseInrDisplay, resolveSaleInrDisplay } from '@/lib/icTransfer/metalSettlement';
import { INR_PER_UNIT } from '@/lib/icTransfer/rateCalculations';
import { fmtLedgerAed, fmtLedgerInr } from '@/lib/icFunds/format';
import type { ICPurchase, ICRegion, ICSale, ICWarehouse } from '@/types';

export type WarehouseMatrixRow = {
  warehouseId: string;
  warehouseName: string;
  regionName: string;
  currentStock: number;
  currentMetalG: number;
  cashPurchases: number;
  metalPurchases: number;
  cashSales: number;
  metalSales: number;
  cashPurchaseAed: number;
  /** Notional IC purchases in INR (units × ₹1 lakh) in range. */
  cashPurchaseInr: number;
  metalPurchaseAed: number;
  metalPurchaseInr: number;
  cashSaleAed: number;
  /** Notional IC sales in INR (units × ₹1 lakh) in range. */
  cashSaleInr: number;
  metalSaleAed: number;
  metalSaleInr: number;
  cashGrossProfitAed: number;
  cashGrossProfitInr: number;
  metalProfitAed: number;
  metalProfitInr: number;
  /** Unsold cash-metal lots at net INR cost (as at range end). */
  metalStockInr: number;
  /**
   * Weighted average AED **rate** on remaining IC units (cash IC + metal-INR inflows),
   * not an AED balance. Same basis as metal prefill RATE (~36).
   */
  icStockAvgAedRate: number;
};

export type RegionSummaryRow = {
  regionId: string;
  regionName: string;
  warehouseCount: number;
  currentStock: number;
  currentMetalG: number;
  cashPurchases: number;
  metalPurchases: number;
  cashSales: number;
  metalSales: number;
  cashPurchaseAed: number;
  cashPurchaseInr: number;
  metalPurchaseAed: number;
  metalPurchaseInr: number;
  cashSaleAed: number;
  cashSaleInr: number;
  metalSaleAed: number;
  metalSaleInr: number;
  cashGrossProfitAed: number;
  cashGrossProfitInr: number;
  metalProfitAed: number;
  metalProfitInr: number;
  metalStockInr: number;
  icStockAvgAedRate: number;
};

export type WarehouseInventoryTotals = {
  currentStock: number;
  currentMetalG: number;
  cashPurchases: number;
  metalPurchases: number;
  cashSales: number;
  metalSales: number;
  cashPurchaseAed: number;
  cashPurchaseInr: number;
  metalPurchaseAed: number;
  metalPurchaseInr: number;
  cashSaleAed: number;
  cashSaleInr: number;
  metalSaleAed: number;
  metalSaleInr: number;
  cashGrossProfitAed: number;
  cashGrossProfitInr: number;
  metalProfitAed: number;
  metalProfitInr: number;
  metalStockInr: number;
  icStockAvgAedRate: number;
};

function sumPurchaseAed(purchases: ICPurchase[], metal: boolean): number {
  return purchases
    .filter(p => isMetalMode(p.settlementMode) === metal)
    .reduce((sum, p) => sum + dealPurchaseAed(p), 0);
}

function sumSaleAed(sales: ICSale[], metal: boolean): number {
  return sales
    .filter(s => isMetalMode(s.settlementMode) === metal)
    .reduce((sum, s) => sum + dealSaleAed(s), 0);
}

function sumCashNotionalInrPurchases(purchases: ICPurchase[]): number {
  return purchases
    .filter(p => !isMetalMode(p.settlementMode))
    .reduce((sum, p) => sum + (Number(p.units) || 0) * INR_PER_UNIT, 0);
}

function sumCashNotionalInrSales(sales: ICSale[]): number {
  return sales
    .filter(s => !isMetalMode(s.settlementMode))
    .reduce((sum, s) => sum + (Number(s.units) || 0) * INR_PER_UNIT, 0);
}

function sumMetalPurchaseInr(purchases: ICPurchase[]): number {
  return purchases
    .filter(p => isMetalMode(p.settlementMode))
    .reduce((sum, p) => sum + resolvePurchaseInrDisplay(p), 0);
}

function sumMetalSaleInr(sales: ICSale[]): number {
  return sales
    .filter(s => isMetalMode(s.settlementMode))
    .reduce((sum, s) => sum + resolveSaleInrDisplay(s), 0);
}

export type WarehouseMatrixResult = {
  rows: WarehouseMatrixRow[];
  totals: WarehouseInventoryTotals;
  regionRows: RegionSummaryRow[];
};

function txnInRange(createdAt: string | undefined, range: DateFilterRange): boolean {
  if (!createdAt) return !range.startDate && !range.endDate;
  return isDateInRange(createdAt.slice(0, 10), range);
}

function isMetalMode(mode: string | undefined): boolean {
  return mode === 'metal';
}

/** Metal grams from deals: opening + purchases minus completed sales (DB column is a cache). */
export function computeWarehouseMetalGramsOnHand(
  purchases: ICPurchase[],
  sales: ICSale[],
  warehouseId: string,
  openingMetalG = 0,
): number {
  let grams = Number(openingMetalG) || 0;
  for (const p of purchases) {
    if (p.warehouseId !== warehouseId || !isMetalMode(p.settlementMode)) continue;
    grams += Number(p.metalWeightG) || 0;
  }
  for (const s of sales) {
    if (s.warehouseId !== warehouseId || !isMetalMode(s.settlementMode)) continue;
    if (String(s.orderStatus || '') !== 'completed') continue;
    grams -= Number(s.metalWeightG) || 0;
  }
  return Number(grams.toFixed(4));
}

function countPurchases(purchases: ICPurchase[], metal: boolean): number {
  return purchases.filter(p => isMetalMode(p.settlementMode) === metal).length;
}

function countSales(sales: ICSale[], metal: boolean): number {
  return sales.filter(s => isMetalMode(s.settlementMode) === metal).length;
}

function computeRow(
  warehouse: ICWarehouse,
  regionName: string,
  purchases: ICPurchase[],
  sales: ICSale[],
  range: DateFilterRange,
): WarehouseMatrixRow {
  const warehousePurchases = purchases.filter(p => p.warehouseId === warehouse.id);
  const warehouseSales = sales.filter(s => s.warehouseId === warehouse.id);
  const inRangePurchases = warehousePurchases.filter(p => txnInRange(p.createdAt, range));
  const inRangeSales = warehouseSales.filter(s => txnInRange(s.createdAt, range));
  const profit = computeDealProfit({
    purchases: warehousePurchases,
    sales: warehouseSales,
    range,
    warehouseId: warehouse.id,
  });

  const currentStock = computeWarehouseIcUnitsOnHand(
    warehousePurchases,
    warehouseSales,
    warehouse.id,
    warehouse.openingStock,
  );

  return {
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    regionName,
    currentStock,
    currentMetalG: computeWarehouseMetalGramsOnHand(
      warehousePurchases,
      warehouseSales,
      warehouse.id,
      warehouse.openingMetalG,
    ),
    cashPurchases: countPurchases(inRangePurchases, false),
    metalPurchases: countPurchases(inRangePurchases, true),
    cashSales: countSales(inRangeSales, false),
    metalSales: countSales(inRangeSales, true),
    cashPurchaseAed: sumPurchaseAed(inRangePurchases, false),
    cashPurchaseInr: sumCashNotionalInrPurchases(inRangePurchases),
    metalPurchaseAed: sumPurchaseAed(inRangePurchases, true),
    metalPurchaseInr: sumMetalPurchaseInr(inRangePurchases),
    cashSaleAed: sumSaleAed(inRangeSales, false),
    cashSaleInr: sumCashNotionalInrSales(inRangeSales),
    metalSaleAed: sumSaleAed(inRangeSales, true),
    metalSaleInr: sumMetalSaleInr(inRangeSales),
    cashGrossProfitAed: profit.cashGrossProfitAed,
    cashGrossProfitInr: profit.cashGrossProfitInr,
    metalProfitAed: profit.metalProfitAed,
    metalProfitInr: profit.metalProfitInr,
    metalStockInr: remainingCashMetalInrCost(warehousePurchases, warehouseSales, {
      through: range.endDate,
    }),
    icStockAvgAedRate: computeWarehouseIcStockWac(warehousePurchases, warehouseSales, warehouse.id),
  };
}

function sumRows(rows: WarehouseMatrixRow[], pick: (r: WarehouseMatrixRow) => number): number {
  return rows.reduce((sum, r) => sum + pick(r), 0);
}

/** Blend per-warehouse average IC rate by remaining units (stock-weighted). */
function weightedAverageIcStockRate(rows: { currentStock: number; icStockAvgAedRate: number }[]): number {
  let weight = 0;
  let numer = 0;
  for (const row of rows) {
    const u = Number(row.currentStock) || 0;
    const r = Number(row.icStockAvgAedRate) || 0;
    if (u <= 0 || r <= 0) continue;
    numer += u * r;
    weight += u;
  }
  if (weight <= 0) return 0;
  return Number((numer / weight).toFixed(4));
}

/** On-hand IC units at warehouse (no order reservation). */
export function computeWarehouseAvailableUnits(
  warehouse: ICWarehouse,
  purchases: ICPurchase[],
  sales: ICSale[],
): number {
  return computeWarehouseIcUnitsOnHand(purchases, sales, warehouse.id, warehouse.openingStock);
}

export function computeWarehouseMatrix(options: {
  warehouses: ICWarehouse[];
  regions: ICRegion[];
  purchases: ICPurchase[];
  sales: ICSale[];
  range: DateFilterRange;
  regionIds?: string[];
}): WarehouseMatrixResult {
  const { warehouses, regions, purchases, sales, range, regionIds } = options;

  const regionNameById = new Map(regions.map(r => [r.id, r.name]));
  const regionFilter = regionIds && regionIds.length > 0 ? new Set(regionIds) : null;
  const filteredWarehouses = regionFilter
    ? warehouses.filter(w => w.regionId && regionFilter.has(w.regionId))
    : warehouses;

  const rows = filteredWarehouses
    .map(warehouse =>
      computeRow(warehouse, regionNameById.get(warehouse.regionId || '') || '—', purchases, sales, range),
    )
    .sort((a, b) => a.warehouseName.localeCompare(b.warehouseName));

  const totals: WarehouseInventoryTotals = {
    currentStock: sumRows(rows, r => r.currentStock),
    currentMetalG: sumRows(rows, r => r.currentMetalG),
    cashPurchases: sumRows(rows, r => r.cashPurchases),
    metalPurchases: sumRows(rows, r => r.metalPurchases),
    cashSales: sumRows(rows, r => r.cashSales),
    metalSales: sumRows(rows, r => r.metalSales),
    cashPurchaseAed: sumRows(rows, r => r.cashPurchaseAed),
    cashPurchaseInr: sumRows(rows, r => r.cashPurchaseInr),
    metalPurchaseAed: sumRows(rows, r => r.metalPurchaseAed),
    metalPurchaseInr: sumRows(rows, r => r.metalPurchaseInr),
    cashSaleAed: sumRows(rows, r => r.cashSaleAed),
    cashSaleInr: sumRows(rows, r => r.cashSaleInr),
    metalSaleAed: sumRows(rows, r => r.metalSaleAed),
    metalSaleInr: sumRows(rows, r => r.metalSaleInr),
    cashGrossProfitAed: sumRows(rows, r => r.cashGrossProfitAed),
    cashGrossProfitInr: sumRows(rows, r => r.cashGrossProfitInr),
    metalProfitAed: sumRows(rows, r => r.metalProfitAed),
    metalProfitInr: sumRows(rows, r => r.metalProfitInr),
    metalStockInr: sumRows(rows, r => r.metalStockInr),
    icStockAvgAedRate: weightedAverageIcStockRate(rows),
  };

  const regionRows = regions
    .map(region => {
      if (regionFilter && !regionFilter.has(region.id)) return null;

      const regionWarehouses = filteredWarehouses.filter(w => w.regionId === region.id);
      if (regionWarehouses.length === 0) return null;

      const regionRowsData = rows.filter(r =>
        regionWarehouses.some(w => w.id === r.warehouseId),
      );

      return {
        regionId: region.id,
        regionName: region.name,
        warehouseCount: regionWarehouses.length,
        currentStock: sumRows(regionRowsData, r => r.currentStock),
        currentMetalG: sumRows(regionRowsData, r => r.currentMetalG),
        cashPurchases: sumRows(regionRowsData, r => r.cashPurchases),
        metalPurchases: sumRows(regionRowsData, r => r.metalPurchases),
        cashSales: sumRows(regionRowsData, r => r.cashSales),
        metalSales: sumRows(regionRowsData, r => r.metalSales),
        cashPurchaseAed: sumRows(regionRowsData, r => r.cashPurchaseAed),
        cashPurchaseInr: sumRows(regionRowsData, r => r.cashPurchaseInr),
        metalPurchaseAed: sumRows(regionRowsData, r => r.metalPurchaseAed),
        metalPurchaseInr: sumRows(regionRowsData, r => r.metalPurchaseInr),
        cashSaleAed: sumRows(regionRowsData, r => r.cashSaleAed),
        cashSaleInr: sumRows(regionRowsData, r => r.cashSaleInr),
        metalSaleAed: sumRows(regionRowsData, r => r.metalSaleAed),
        metalSaleInr: sumRows(regionRowsData, r => r.metalSaleInr),
        cashGrossProfitAed: sumRows(regionRowsData, r => r.cashGrossProfitAed),
        cashGrossProfitInr: sumRows(regionRowsData, r => r.cashGrossProfitInr),
        metalProfitAed: sumRows(regionRowsData, r => r.metalProfitAed),
        metalProfitInr: sumRows(regionRowsData, r => r.metalProfitInr),
        metalStockInr: sumRows(regionRowsData, r => r.metalStockInr),
        icStockAvgAedRate: weightedAverageIcStockRate(regionRowsData),
      } satisfies RegionSummaryRow;
    })
    .filter((row): row is RegionSummaryRow => row !== null && row.warehouseCount > 0)
    .sort((a, b) => a.regionName.localeCompare(b.regionName));

  return { rows, totals, regionRows };
}

export function computeSingleWarehouseMetrics(
  warehouse: ICWarehouse,
  regions: ICRegion[],
  purchases: ICPurchase[],
  sales: ICSale[],
  range: DateFilterRange,
): WarehouseInventoryTotals {
  const regionName = regions.find(r => r.id === warehouse.regionId)?.name || '—';
  const row = computeRow(warehouse, regionName, purchases, sales, range);
  return {
    currentStock: row.currentStock,
    currentMetalG: row.currentMetalG,
    cashPurchases: row.cashPurchases,
    metalPurchases: row.metalPurchases,
    cashSales: row.cashSales,
    metalSales: row.metalSales,
    cashPurchaseAed: row.cashPurchaseAed,
    cashPurchaseInr: row.cashPurchaseInr,
    metalPurchaseAed: row.metalPurchaseAed,
    metalPurchaseInr: row.metalPurchaseInr,
    cashSaleAed: row.cashSaleAed,
    cashSaleInr: row.cashSaleInr,
    metalSaleAed: row.metalSaleAed,
    metalSaleInr: row.metalSaleInr,
    cashGrossProfitAed: row.cashGrossProfitAed,
    cashGrossProfitInr: row.cashGrossProfitInr,
    metalProfitAed: row.metalProfitAed,
    metalProfitInr: row.metalProfitInr,
    metalStockInr: row.metalStockInr,
    icStockAvgAedRate: row.icStockAvgAedRate,
  };
}

export const WAREHOUSE_MATRIX_COLUMNS = [
  'IC stock',
  'Metal (g)',
  'IC purchases',
  'Metal purchases',
  'IC sales',
  'Metal sales',
  'IC P&L',
  'Metal P&L',
] as const;

function formatMatrixCount(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatMatrixStock(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function formatMatrixMoney(value: number): string {
  if (Math.abs(value) < 0.005) return '—';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function matrixRowToCells(row: WarehouseMatrixRow): string[] {
  return [
    formatMatrixStock(row.currentStock),
    formatMatrixStock(row.currentMetalG),
    formatMatrixCount(row.cashPurchases),
    formatMatrixCount(row.metalPurchases),
    formatMatrixCount(row.cashSales),
    formatMatrixCount(row.metalSales),
    fmtLedgerAed(row.cashGrossProfitAed),
    fmtLedgerInr(row.metalProfitInr),
  ];
}

export function formatMetalGrams(value: number | undefined | null): string {
  const n = Number(value ?? 0);
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 4 })} g`;
}

export function sumMetalWeightG(purchases: ICPurchase[]): number {
  return purchases
    .filter(p => isMetalMode(p.settlementMode))
    .reduce((sum, p) => sum + (Number(p.metalWeightG) || 0), 0);
}

export function sumMetalSaleWeightG(sales: ICSale[]): number {
  return sales
    .filter(s => isMetalMode(s.settlementMode))
    .reduce((sum, s) => sum + (Number(s.metalWeightG) || 0), 0);
}
