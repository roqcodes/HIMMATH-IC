import { isDateInRange, type DateFilterRange } from '@/lib/dateFilterRange';
import { effectivePurchaseCounterpartyId } from '@/lib/counterparties/effectiveId';
import type { ICFundVoucher, ICPurchase, ICSale } from '@/types';

export function txnInCounterpartyRange(createdAt: string | undefined, range: DateFilterRange): boolean {
  if (!createdAt) return !range.startDate && !range.endDate;
  return isDateInRange(createdAt.slice(0, 10), range);
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

export type CounterpartyActivityKind = 'purchase' | 'sale' | 'voucher';

export type CounterpartyActivityRow =
  | { kind: 'purchase'; at: string; purchase: ICPurchase }
  | { kind: 'sale'; at: string; sale: ICSale }
  | { kind: 'voucher'; at: string; voucher: ICFundVoucher };

/** Cash movements posted in IC Funds against this party's personal account. */
export function isCounterpartyAccountingVoucher(voucher: Pick<ICFundVoucher, 'voucherType' | 'referenceType' | 'status'>): boolean {
  if (voucher.status === 'void') return false;
  const ref = voucher.referenceType || '';
  if (ref.startsWith('ic_fund_')) return true;
  if (voucher.voucherType === 'payment' || voucher.voucherType === 'receipt') return true;
  return voucher.voucherType === 'journal' && !ref;
}

export function mergeCounterpartyActivity(
  purchases: ICPurchase[],
  sales: ICSale[],
  vouchers: ICFundVoucher[] = [],
): CounterpartyActivityRow[] {
  const rows: CounterpartyActivityRow[] = [
    ...purchases.map(p => ({ kind: 'purchase' as const, at: p.createdAt || '', purchase: p })),
    ...sales.map(s => ({ kind: 'sale' as const, at: s.createdAt || '', sale: s })),
    ...vouchers
      .filter(isCounterpartyAccountingVoucher)
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
