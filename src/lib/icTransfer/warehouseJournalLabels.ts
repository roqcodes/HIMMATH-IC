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

  if (ref === 'ic_purchase') {
    const p = purchases.find(x => x.id === id);
    return isMetal(p?.settlementMode) ? 'Metal purchase' : 'IC purchase';
  }

  const sale = sales.find(x => x.id === id);
  const metal = isMetal(sale?.settlementMode);

  switch (ref) {
    case 'ic_sale':
      return metal ? 'Metal sale (receivable)' : 'IC sale (receivable)';
    case 'ic_sale_cogs':
      return metal ? 'Metal COGS' : 'IC COGS';
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

  if (voucher.referenceType === 'ic_purchase') {
    const p = purchases.find(x => x.id === id);
    return p ? getFormattedTxnId(p.id, 'purchase', p) : id.slice(0, 8);
  }

  const s = sales.find(x => x.id === id);
  if (s) return getFormattedTxnId(s.id, 'sale', s);
  return id.slice(0, 8);
}
