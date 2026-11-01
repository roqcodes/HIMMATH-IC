import { isDateInRange, type DateFilterRange } from '@/lib/dateFilterRange';
import { computeDealProfit } from '@/lib/icTransfer/dealProfit';
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
  metalPurchaseAed: number;
  cashSaleAed: number;
  metalSaleAed: number;
  cashGrossProfitAed: number;
  metalProfitAed: number;
  metalProfitInr: number;
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
  metalPurchaseAed: number;
  cashSaleAed: number;
  metalSaleAed: number;
  cashGrossProfitAed: number;
  metalProfitAed: number;
  metalProfitInr: number;
};

export type WarehouseInventoryTotals = {
  currentStock: number;
  currentMetalG: number;
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

function sumPurchaseAed(purchases: ICPurchase[], metal: boolean): number {
  return purchases
    .filter(p => isMetalMode(p.settlementMode) === metal)
    .reduce((sum, p) => sum + (Number(p.aedTotal) || 0), 0);
}

function sumSaleAed(sales: ICSale[], metal: boolean): number {
  return sales
    .filter(s => isMetalMode(s.settlementMode) === metal)
    .reduce((sum, s) => sum + (Number(s.aedAmount) || 0) + (Number(s.serviceCharge) || 0), 0);
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

  return {
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    regionName,
    currentStock: Number(warehouse.currentStock ?? 0),
    currentMetalG: Number(warehouse.currentMetalG ?? 0),
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

function sumRows(rows: WarehouseMatrixRow[], pick: (r: WarehouseMatrixRow) => number): number {
  return rows.reduce((sum, r) => sum + pick(r), 0);
}

/** On-hand IC units at warehouse (no order reservation). */
export function computeWarehouseAvailableUnits(warehouse: ICWarehouse, _sales?: ICSale[]): number {
  return Number(warehouse.currentStock ?? 0);
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
    metalPurchaseAed: sumRows(rows, r => r.metalPurchaseAed),
    cashSaleAed: sumRows(rows, r => r.cashSaleAed),
    metalSaleAed: sumRows(rows, r => r.metalSaleAed),
    cashGrossProfitAed: sumRows(rows, r => r.cashGrossProfitAed),
    metalProfitAed: sumRows(rows, r => r.metalProfitAed),
    metalProfitInr: sumRows(rows, r => r.metalProfitInr),
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
        metalPurchaseAed: sumRows(regionRowsData, r => r.metalPurchaseAed),
        cashSaleAed: sumRows(regionRowsData, r => r.cashSaleAed),
        metalSaleAed: sumRows(regionRowsData, r => r.metalSaleAed),
        cashGrossProfitAed: sumRows(regionRowsData, r => r.cashGrossProfitAed),
        metalProfitAed: sumRows(regionRowsData, r => r.metalProfitAed),
        metalProfitInr: sumRows(regionRowsData, r => r.metalProfitInr),
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
    metalPurchaseAed: row.metalPurchaseAed,
    cashSaleAed: row.cashSaleAed,
    metalSaleAed: row.metalSaleAed,
    cashGrossProfitAed: row.cashGrossProfitAed,
    metalProfitAed: row.metalProfitAed,
    metalProfitInr: row.metalProfitInr,
  };
}

export const WAREHOUSE_MATRIX_COLUMNS = [
  'Stock',
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
    formatMatrixMoney(row.cashGrossProfitAed),
    formatMatrixMoney(row.metalProfitAed),
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
