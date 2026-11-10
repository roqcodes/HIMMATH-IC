import { getFormattedTxnId } from '@/lib/icTransferMappers';
import {
  purchaseDealAed,
  purchaseDealInr,
  saleDealInr,
  saleTableDisplayAed,
} from '@/lib/icTransfer/dealTableDisplay';
import { formatSettlementModeLabel } from '@/lib/icTransfer/metalSettlement';
import type { SaleLineProfit } from '@/lib/icTransfer/dealProfit';
import { effectivePurchaseCounterpartyId } from '@/lib/counterparties/effectiveId';
import type { CounterpartyActivityRow } from '@/lib/counterparties/counterpartyActivity';
import type { WarehouseActivityRow } from '@/lib/icTransfer/warehouseActivity';
import type { ICPurchase, ICSale } from '@/types';

export type TableSortOrder = 'asc' | 'desc';

function sortMultiplier(order: TableSortOrder): number {
  return order === 'asc' ? 1 : -1;
}

function compareValues(a: string | number, b: string | number, order: TableSortOrder): number {
  const dir = sortMultiplier(order);
  if (typeof a === 'number' && typeof b === 'number') {
    return (a - b) * dir;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true }) * dir;
}

function dealBookLabel(
  settlementMode: ICPurchase['settlementMode'],
  metalPaymentMethod?: ICPurchase['metalPaymentMethod'],
): string {
  const metal = settlementMode === 'metal';
  const pay = metalPaymentMethod === 'AED' ? 'AED' : 'CASH';
  return metal ? (pay === 'AED' ? 'Metal · AED' : 'Metal · INR') : 'IC · AED';
}

export function counterpartyPurchaseSortValue(
  p: ICPurchase,
  field: string,
  warehouseName: (id?: string) => string,
): string | number {
  switch (field) {
    case 'ID':
      return getFormattedTxnId(p.id, 'purchase', p);
    case 'Warehouse':
      return warehouseName(p.warehouseId);
    case 'Book':
      return dealBookLabel(p.settlementMode, p.metalPaymentMethod);
    case 'Qty':
      return p.settlementMode === 'metal' ? Number(p.metalWeightG ?? 0) : Number(p.units ?? 0);
    case 'INR':
      return purchaseDealInr(p);
    case 'AED':
      return purchaseDealAed(p);
    case 'Date':
    default:
      return new Date(p.createdAt || 0).getTime();
  }
}

export function counterpartySaleSortValue(
  s: ICSale,
  field: string,
  warehouseName: (id?: string) => string,
): string | number {
  switch (field) {
    case 'ID':
      return getFormattedTxnId(s.id, 'sale', s);
    case 'Warehouse':
      return warehouseName(s.warehouseId);
    case 'Book':
      return dealBookLabel(s.settlementMode, s.metalPaymentMethod);
    case 'Qty':
      return s.settlementMode === 'metal' ? Number(s.metalWeightG ?? 0) : Number(s.units ?? 0);
    case 'INR':
      return saleDealInr(s);
    case 'AED':
      return saleTableDisplayAed(s);
    case 'Date':
    default:
      return new Date(s.createdAt || 0).getTime();
  }
}

export function sortCounterpartyPurchases(
  rows: ICPurchase[],
  sortField: string,
  sortOrder: TableSortOrder,
  warehouseName: (id?: string) => string,
): ICPurchase[] {
  return [...rows].sort((a, b) =>
    compareValues(
      counterpartyPurchaseSortValue(a, sortField, warehouseName),
      counterpartyPurchaseSortValue(b, sortField, warehouseName),
      sortOrder,
    ),
  );
}

export function sortCounterpartySales(
  rows: ICSale[],
  sortField: string,
  sortOrder: TableSortOrder,
  warehouseName: (id?: string) => string,
): ICSale[] {
  return [...rows].sort((a, b) =>
    compareValues(
      counterpartySaleSortValue(a, sortField, warehouseName),
      counterpartySaleSortValue(b, sortField, warehouseName),
      sortOrder,
    ),
  );
}

export function counterpartyActivitySortValue(
  row: CounterpartyActivityRow,
  field: string,
  warehouseName: (id?: string) => string,
): string | number {
  if (row.kind === 'purchase') {
    if (field === 'Type') return 'purchase';
    return counterpartyPurchaseSortValue(row.purchase, field, warehouseName);
  }
  if (row.kind === 'sale') {
    if (field === 'Type') return 'sale';
    return counterpartySaleSortValue(row.sale, field, warehouseName);
  }
  const v = row.voucher;
  switch (field) {
    case 'Type':
      return v.voucherType || 'journal';
    case 'ID':
      return v.voucherNo;
    case 'Warehouse':
      return '';
    case 'Book':
      return v.book ?? '';
    case 'Qty':
      return 0;
    case 'INR':
      return v.book === 'INR' ? v.amount : 0;
    case 'AED':
      return v.book === 'INR' ? 0 : v.amount;
    case 'Date':
    default:
      return new Date(v.createdAt || v.voucherDate || 0).getTime();
  }
}

export function sortCounterpartyActivity(
  rows: CounterpartyActivityRow[],
  sortField: string,
  sortOrder: TableSortOrder,
  warehouseName: (id?: string) => string,
): CounterpartyActivityRow[] {
  return [...rows].sort((a, b) =>
    compareValues(
      counterpartyActivitySortValue(a, sortField, warehouseName),
      counterpartyActivitySortValue(b, sortField, warehouseName),
      sortOrder,
    ),
  );
}

export type WarehouseDetailSortCtx = {
  supplierName: (id: string) => string;
  saleCustomerName: (s: ICSale) => string;
  saleProfits: Map<string, SaleLineProfit>;
};

export function warehousePurchaseSortValue(p: ICPurchase, field: string, ctx: WarehouseDetailSortCtx): string | number {
  switch (field) {
    case 'ID':
      return getFormattedTxnId(p.id, 'purchase', p);
    case 'Party':
      return ctx.supplierName(effectivePurchaseCounterpartyId(p) || p.supplierId || '');
    case 'Settlement':
      return formatSettlementModeLabel(p.settlementMode, p.metalPaymentMethod);
    case 'Units':
      return p.settlementMode === 'metal' ? 0 : Number(p.units ?? 0);
    case 'Metal (g)':
      return p.settlementMode === 'metal' ? Number(p.metalWeightG ?? 0) : 0;
    case 'INR':
      return purchaseDealInr(p);
    case 'AED':
      return purchaseDealAed(p);
    case 'Profit':
      return 0;
    case 'Date':
    default:
      return new Date(p.createdAt || 0).getTime();
  }
}

export function warehouseSaleSortValue(s: ICSale, field: string, ctx: WarehouseDetailSortCtx): string | number {
  switch (field) {
    case 'ID':
      return getFormattedTxnId(s.id, 'sale', s);
    case 'Party':
      return ctx.saleCustomerName(s);
    case 'Settlement':
      return formatSettlementModeLabel(s.settlementMode, s.metalPaymentMethod);
    case 'Units':
      return s.settlementMode === 'metal' ? 0 : Number(s.units ?? 0);
    case 'Metal (g)':
      return s.settlementMode === 'metal' ? Number(s.metalWeightG ?? 0) : 0;
    case 'INR':
      return saleDealInr(s);
    case 'AED':
      return saleTableDisplayAed(s);
    case 'Profit':
      return ctx.saleProfits.get(s.id)?.amount ?? 0;
    case 'Date':
    default:
      return new Date(s.createdAt || 0).getTime();
  }
}

export function sortWarehousePurchases(
  rows: ICPurchase[],
  sortField: string,
  sortOrder: TableSortOrder,
  ctx: WarehouseDetailSortCtx,
): ICPurchase[] {
  return [...rows].sort((a, b) =>
    compareValues(warehousePurchaseSortValue(a, sortField, ctx), warehousePurchaseSortValue(b, sortField, ctx), sortOrder),
  );
}

export function sortWarehouseSales(
  rows: ICSale[],
  sortField: string,
  sortOrder: TableSortOrder,
  ctx: WarehouseDetailSortCtx,
): ICSale[] {
  return [...rows].sort((a, b) =>
    compareValues(warehouseSaleSortValue(a, sortField, ctx), warehouseSaleSortValue(b, sortField, ctx), sortOrder),
  );
}

export function warehouseActivitySortValue(row: WarehouseActivityRow, field: string, ctx: WarehouseDetailSortCtx): string | number {
  if (row.kind === 'purchase') {
    if (field === 'Type') return 'purchase';
    return warehousePurchaseSortValue(row.purchase, field, ctx);
  }
  if (field === 'Type') return 'sale';
  return warehouseSaleSortValue(row.sale, field, ctx);
}

export function sortWarehouseActivity(
  rows: WarehouseActivityRow[],
  sortField: string,
  sortOrder: TableSortOrder,
  ctx: WarehouseDetailSortCtx,
): WarehouseActivityRow[] {
  return [...rows].sort((a, b) =>
    compareValues(warehouseActivitySortValue(a, sortField, ctx), warehouseActivitySortValue(b, sortField, ctx), sortOrder),
  );
}
