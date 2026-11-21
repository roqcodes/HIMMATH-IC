import type { ICFundVoucher } from '@/types';
import type { ICSale } from '@/types';
import type { SaleLineProfit } from '@/lib/icTransfer/dealProfit';

const PROFIT_MEMO_PREFIX = 'party-profit-memo-';

export function journalDealEntityId(referenceId?: string | null): string {
  const raw = String(referenceId || '').trim();
  if (!raw) return '';
  const hash = raw.indexOf('#');
  return hash >= 0 ? raw.slice(0, hash) : raw;
}

function hasMetalSaleProfitVoucher(vouchers: ICFundVoucher[], saleId: string): boolean {
  return vouchers.some(
    v =>
      v.status !== 'void' &&
      v.referenceType === 'metal_sale_profit' &&
      journalDealEntityId(v.referenceId) === saleId,
  );
}

/** Show deal metal profit on the party journal list when books omit a profit row. */
export function augmentPartyJournalsWithMetalProfit(
  vouchers: ICFundVoucher[],
  sales: ICSale[],
  profits: Map<string, SaleLineProfit>,
  counterpartyId: string,
): ICFundVoucher[] {
  const id = String(counterpartyId || '').trim();
  if (!id) return vouchers;

  const memos: ICFundVoucher[] = [];
  for (const s of sales) {
    if (s.settlementMode !== 'metal' || String(s.orderStatus || '') !== 'completed') continue;
    if (String(s.counterpartyId || '') !== id) continue;
    const line = profits.get(s.id);
    if (!line || line.currency !== 'INR' || Math.abs(line.amount) < 0.005) continue;
    if (hasMetalSaleProfitVoucher(vouchers, s.id)) continue;

    const iso = s.createdAt || new Date().toISOString();
    const date = iso.slice(0, 10);
    memos.push({
      id: `${PROFIT_MEMO_PREFIX}${s.id}`,
      branchId: '',
      voucherNo: 0,
      voucherType: 'journal',
      voucherDate: date,
      debitAccountId: 'memo',
      creditAccountId: 'memo',
      debitAccountName: 'Metal Sales',
      creditAccountName: 'Metal Profit',
      debitAccountType: 'income',
      creditAccountType: 'profit',
      amount: Math.abs(line.amount),
      notes: 'Metal profit (from deal)',
      createdAt: iso,
      status: 'active',
      referenceType: 'metal_sale_profit',
      referenceId: s.id,
      book: 'INR',
    });
  }
  if (memos.length === 0) return vouchers;
  return [...vouchers, ...memos];
}

export function isPartyProfitMemoVoucher(id: string): boolean {
  return id.startsWith(PROFIT_MEMO_PREFIX);
}
