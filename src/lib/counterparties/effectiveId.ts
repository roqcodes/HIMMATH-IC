import type { ICPurchase, ICSale } from '@/types';

export function effectivePurchaseCounterpartyId(p: Pick<ICPurchase, 'counterpartyId' | 'supplierId'>): string {
  return String(p.counterpartyId || p.supplierId || '');
}

export function effectiveSaleCounterpartyId(
  sale: Pick<ICSale, 'counterpartyId' | 'orderCustomerId'>,
  legacyCustomerIdByCounterparty?: string | null,
): string {
  if (sale.counterpartyId) return sale.counterpartyId;
  if (legacyCustomerIdByCounterparty) return legacyCustomerIdByCounterparty;
  return '';
}
