import { getFormattedTxnId } from '@/lib/icTransferMappers';
import type { ICPurchase, ICSale, ICFundVoucher } from '@/types';

function isMetal(mode: string | undefined | null): boolean {
  return mode === 'metal';
}

/** Human label for warehouse-linked IC Funds entries (purchase, sale, COGS, profit). */
export function warehouseJournalEntryLabel(
  voucher: Pick<ICFundVoucher, 'referenceType' | 'referenceId'>,
  purchases: ICPurchase[],
  sales: ICSale[],
): string {
  const ref = voucher.referenceType;
  const id = voucher.referenceId;

  if (ref === 'ic_purchase' || ref === 'metal_purchase') {
    const p = purchases.find(x => x.id === id);
    if (ref === 'metal_purchase') return 'Bought metal';
    return isMetal(p?.settlementMode) ? 'Bought metal' : 'IC purchase';
  }
  if (ref === 'lab_test_purchase') return 'Lab deducted (purchase)';
  if (ref === 'lab_test_sale') return 'Lab deducted (sale)';
  if (ref === 'metal_purchase_aed') return 'Paid via agent';
  if (ref === 'metal_sale_aed') return 'Collected via agent';
  if (ref === 'metal_sale_ic_stock') return 'IC units from metal';
  if (ref === 'metal_fx_profit') return 'Metal FX (AED)';
  if (ref === 'metal_sale_cogs') return 'Cost of metal sold';
  if (ref === 'metal_sale_receipt') return 'Sold metal';
  if (ref === 'metal_sale_profit') return 'Metal profit';

  const sale = sales.find(x => x.id === id);
  const metal = isMetal(sale?.settlementMode);

  switch (ref) {
    case 'ic_sale':
      return metal ? 'Sold metal' : 'Sold IC';
    case 'ic_sale_cogs':
      return metal ? 'Cost of metal sold' : 'Cost of IC sold';
    case 'ic_sale_profit':
      return metal ? 'Metal profit' : 'IC profit';
    default:
      return ref || '—';
  }
}

export function warehouseJournalDealRef(
  voucher: Pick<ICFundVoucher, 'referenceType' | 'referenceId'>,
  purchases: ICPurchase[],
  sales: ICSale[],
): string {
  const id = voucher.referenceId;
  if (!id) return '—';

  if (voucher.referenceType === 'ic_purchase' || voucher.referenceType === 'metal_purchase' || voucher.referenceType === 'metal_purchase_aed' || voucher.referenceType === 'lab_test_purchase') {
    const p = purchases.find(x => x.id === id);
    return p ? getFormattedTxnId(p.id, 'purchase', p) : id.slice(0, 8);
  }

  if (voucher.referenceType === 'lab_test_sale') {
    const s = sales.find(x => x.id === id);
    return s ? getFormattedTxnId(s.id, 'sale', s) : id.slice(0, 8);
  }

  const s = sales.find(x => x.id === id);
  if (s) return getFormattedTxnId(s.id, 'sale', s);
  return id.slice(0, 8);
}

/** Same-day story: buy → lab off supplier → bill customer → lab off customer → take cost out → leftover is profit. */
export function journalStoryRank(referenceType?: string | null): number {
  switch (referenceType) {
    case 'metal_purchase':
    case 'ic_purchase':
      return 10;
    case 'lab_test_purchase':
      return 11;
    case 'metal_purchase_aed':
      return 12;
    case 'metal_sale_receipt':
    case 'ic_sale':
    case 'metal_sale_aed':
      return 20;
    case 'lab_test_sale':
      return 21;
    case 'metal_sale_cogs':
    case 'ic_sale_cogs':
      return 22;
    case 'metal_sale_profit':
    case 'ic_sale_profit':
      return 23;
    default:
      return 50;
  }
}

export function sortDealJournals<T extends Pick<ICFundVoucher, 'voucherDate' | 'voucherNo' | 'createdAt' | 'referenceType'>>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const da = String(a.voucherDate || '');
    const db = String(b.voucherDate || '');
    if (da !== db) return db.localeCompare(da);
    const ra = journalStoryRank(a.referenceType);
    const rb = journalStoryRank(b.referenceType);
    if (ra !== rb) return ra - rb;
    return (a.voucherNo || 0) - (b.voucherNo || 0);
  });
}
