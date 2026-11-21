import { isDateInRange, type DateFilterRange } from '@/lib/dateFilterRange';
import { DEFAULT_BRANCH_TIMEZONE, toBusinessDate } from '@/lib/businessTime';
import type { ICPurchase, ICSale } from '@/types';

export function txnInWarehouseRange(createdAt: string | undefined, range: DateFilterRange): boolean {
  if (!createdAt) return !range.startDate && !range.endDate;
  return isDateInRange(toBusinessDate(createdAt, DEFAULT_BRANCH_TIMEZONE), range);
}

export function filterWarehousePurchases(
  purchases: ICPurchase[],
  warehouseId: string,
  range: DateFilterRange,
): ICPurchase[] {
  return purchases.filter(
    p => p.warehouseId === warehouseId && txnInWarehouseRange(p.createdAt, range),
  );
}

export function filterWarehouseSales(
  sales: ICSale[],
  warehouseId: string,
  range: DateFilterRange,
): ICSale[] {
  return sales.filter(
    s => s.warehouseId === warehouseId && txnInWarehouseRange(s.createdAt, range),
  );
}

export type WarehouseActivityKind = 'purchase' | 'sale';

export type WarehouseActivityRow =
  | { kind: 'purchase'; at: string; purchase: ICPurchase }
  | { kind: 'sale'; at: string; sale: ICSale };

export function mergeWarehouseActivity(
  purchases: ICPurchase[],
  sales: ICSale[],
): WarehouseActivityRow[] {
  const rows: WarehouseActivityRow[] = [
    ...purchases.map(p => ({
      kind: 'purchase' as const,
      at: p.createdAt || '',
      purchase: p,
    })),
    ...sales.map(s => ({
      kind: 'sale' as const,
      at: s.createdAt || '',
      sale: s,
    })),
  ];
  rows.sort((a, b) => {
    const ta = new Date(a.at).getTime();
    const tb = new Date(b.at).getTime();
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });
  return rows;
}

export function warehouseTotalProfitAed(cashGrossProfitAed: number, metalProfitAed: number): number {
  return Number((cashGrossProfitAed + metalProfitAed).toFixed(2));
}
