import { isDateInRange, type DateFilterRange } from '@/lib/dateFilterRange';
import { parseCalendarDate } from '@/lib/businessTime';
import { effectivePurchaseCounterpartyId } from '@/lib/counterparties/effectiveId';
import { normalizeCounterpartyKind } from '@/lib/counterparties/roles';
import type { ICBranchDeposit, ICFundVoucher, ICPurchase, ICSale, ICSupplier } from '@/types';

export function txnInCounterpartyRange(createdAt: string | undefined, range: DateFilterRange): boolean {
  if (!createdAt) return !range.startDate && !range.endDate;
  const day = parseCalendarDate(createdAt);
  if (!day) return !range.startDate && !range.endDate;
  return isDateInRange(day, range);
}

export function saleMatchesCounterparty(
  sale: Pick<ICSale, 'counterpartyId' | 'orderCustomerId' | 'aedAgentCounterpartyId' | 'aedAgentId'>,
  counterpartyId: string,
): boolean {
  if (!counterpartyId) return false;
  if (sale.counterpartyId === counterpartyId) return true;
  if (sale.orderCustomerId === counterpartyId) return true;
  if (sale.aedAgentCounterpartyId === counterpartyId) return true;
  if (sale.aedAgentId === counterpartyId) return true;
  return false;
}

export function purchaseMatchesCounterparty(
  purchase: Pick<ICPurchase, 'counterpartyId' | 'supplierId' | 'aedAgentCounterpartyId' | 'aedAgentId'>,
  counterpartyId: string,
): boolean {
  if (effectivePurchaseCounterpartyId(purchase) === counterpartyId) return true;
  if (purchase.aedAgentCounterpartyId === counterpartyId) return true;
  if (purchase.aedAgentId === counterpartyId) return true;
  return false;
}

export function filterCounterpartyPurchases(
  purchases: ICPurchase[],
  counterpartyId: string,
  range: DateFilterRange,
): ICPurchase[] {
  return purchases.filter(
    p =>
      purchaseMatchesCounterparty(p, counterpartyId) && txnInCounterpartyRange(p.createdAt, range),
  );
}

export function filterCounterpartySales(
  sales: ICSale[],
  counterpartyId: string,
  range: DateFilterRange,
): ICSale[] {
  return sales.filter(
    s => saleMatchesCounterparty(s, counterpartyId) && txnInCounterpartyRange(s.createdAt, range),
  );
}

export type CounterpartyActivityKind = 'purchase' | 'sale' | 'voucher' | 'deposit';

export type CounterpartyActivityRow =
  | { kind: 'purchase'; at: string; purchase: ICPurchase }
  | { kind: 'sale'; at: string; sale: ICSale }
  | { kind: 'voucher'; at: string; voucher: ICFundVoucher }
  | { kind: 'deposit'; at: string; deposit: ICBranchDeposit };

/** Non-journal vouchers belong in All; journal vouchers have their own tab. */
export function isCounterpartyActivityVoucher(voucher: Pick<ICFundVoucher, 'voucherType' | 'status'>): boolean {
  if (voucher.status === 'void') return false;
  return voucher.voucherType !== 'journal';
}

export function filterCounterpartyDeposits(
  deposits: ICBranchDeposit[],
  range: DateFilterRange,
): ICBranchDeposit[] {
  return deposits.filter(d => txnInCounterpartyRange(d.depositDate || d.createdAt, range));
}

export function filterManagerTaggedSales(
  sales: ICSale[],
  managerId: string,
  range: DateFilterRange,
): ICSale[] {
  if (!managerId) return [];
  return sales.filter(
    s => s.managerId === managerId && txnInCounterpartyRange(s.createdAt, range),
  );
}

/** @deprecated Use filterManagerTaggedSales */
export function filterManagerCustomerSales(
  sales: ICSale[],
  managerId: string,
  _customers: Pick<ICSupplier, 'id' | 'homeManagerId' | 'kind' | 'status'>[],
  range: DateFilterRange,
): ICSale[] {
  return filterManagerTaggedSales(sales, managerId, range);
}

export function filterManagerTaggedPurchases(
  purchases: ICPurchase[],
  managerId: string,
  range: DateFilterRange,
): ICPurchase[] {
  if (!managerId) return [];
  return purchases.filter(
    p => p.managerId === managerId && txnInCounterpartyRange(p.createdAt, range),
  );
}

export function filterAgentTaggedPurchases(
  purchases: ICPurchase[],
  agentCounterpartyId: string,
  range: DateFilterRange,
): ICPurchase[] {
  if (!agentCounterpartyId) return [];
  return purchases.filter(
    p =>
      purchaseMatchesCounterparty(p, agentCounterpartyId) &&
      txnInCounterpartyRange(p.createdAt, range),
  );
}

export function filterAgentTaggedSales(
  sales: ICSale[],
  agentCounterpartyId: string,
  range: DateFilterRange,
): ICSale[] {
  if (!agentCounterpartyId) return [];
  return sales.filter(
    s =>
      saleMatchesCounterparty(s, agentCounterpartyId) &&
      txnInCounterpartyRange(s.createdAt, range),
  );
}

export function mergeCounterpartyActivity(
  purchases: ICPurchase[],
  sales: ICSale[],
  vouchers: ICFundVoucher[] = [],
  deposits: ICBranchDeposit[] = [],
): CounterpartyActivityRow[] {
  const rows: CounterpartyActivityRow[] = [
    ...purchases.map(p => ({ kind: 'purchase' as const, at: p.createdAt || '', purchase: p })),
    ...sales.map(s => ({ kind: 'sale' as const, at: s.createdAt || '', sale: s })),
    ...deposits.map(d => ({
      kind: 'deposit' as const,
      at: d.depositDate || d.createdAt || '',
      deposit: d,
    })),
    ...vouchers
      .filter(isCounterpartyActivityVoucher)
      .map(v => ({
        kind: 'voucher' as const,
        at: v.createdAt || v.voucherDate || '',
        voucher: v,
      })),
  ];
  rows.sort((a, b) => {
    const ta = new Date(a.at).getTime();
    const tb = new Date(b.at).getTime();
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });
  return rows;
}
