import { journalDealEntityId } from '@/lib/counterparties/counterpartyPartyJournals';
import { getFormattedTxnId } from '@/lib/icTransferMappers';
import type { ICPurchase, ICSale, ICFundVoucher } from '@/types';

const WAREHOUSE_DEAL_REFERENCE_TYPES = new Set([
  'ic_purchase',
  'metal_purchase',
  'metal_purchase_aed',
  'lab_test_purchase',
  'ic_sale',
  'metal_sale_receipt',
  'metal_sale_aed',
  'lab_test_sale',
  'metal_sale_cogs',
  'ic_sale_cogs',
  'metal_sale_profit',
  'ic_sale_profit',
  'metal_sale_ic_stock',
  'metal_fx_profit',
  'ic_branch_deposit',
]);

const JOURNAL_ACCOUNT_DISPLAY_NAMES: Record<string, string> = {
  'Metal AED settlement': 'AED clearing',
  'Metal purchase AED': 'Metal AED',
  'Metal FX Profit': 'Metal FX (AED)',
};

/** Operator-facing names for internal metal clearing accounts (ledger names unchanged). */
export function warehouseJournalAccountDisplayName(name: string): string {
  return JOURNAL_ACCOUNT_DISPLAY_NAMES[name] ?? name;
}

function isMetal(mode: string | undefined | null): boolean {
  return mode === 'metal';
}

function accountingEntryLabel(voucherType?: string | null, referenceType?: string | null): string | null {
  if (
    referenceType === 'ic_fund_payment' ||
    referenceType === 'ic_fund_receipt' ||
    referenceType === 'ic_fund_journal' ||
    !referenceType
  ) {
    if (voucherType === 'payment') return 'Payment';
    if (voucherType === 'receipt') return 'Receipt';
    if (voucherType === 'contra') return 'Contra';
    if (voucherType === 'journal' && (!referenceType || referenceType === 'ic_fund_journal')) {
      return 'Journal';
    }
    if (referenceType === 'ic_fund_payment') return 'Payment';
    if (referenceType === 'ic_fund_receipt') return 'Receipt';
  }
  if (referenceType === 'currency_exchange') return 'Currency exchange';
  return null;
}

/** Human label for warehouse-linked IC Funds entries (purchase, sale, COGS, profit). */
export function warehouseJournalEntryLabel(
  voucher: Pick<ICFundVoucher, 'referenceType' | 'referenceId' | 'voucherType'>,
  purchases: ICPurchase[],
  sales: ICSale[],
): string {
  const accounting = accountingEntryLabel(voucher.voucherType, voucher.referenceType);
  if (accounting) return accounting;

  const ref = voucher.referenceType;
  const id = journalDealEntityId(voucher.referenceId);

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
  if (ref === 'ic_branch_deposit') return 'Customer deposit';
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
      return accountingEntryLabel(voucher.voucherType, ref) || ref || '—';
  }
}

export function warehouseJournalDealRef(
  voucher: Pick<ICFundVoucher, 'referenceType' | 'referenceId'>,
  purchases: ICPurchase[],
  sales: ICSale[],
): string {
  const id = journalDealEntityId(voucher.referenceId);
  if (!id) return '—';
  if (
    voucher.referenceType === 'ic_fund_payment' ||
    voucher.referenceType === 'ic_fund_receipt' ||
    voucher.referenceType === 'ic_fund_journal'
  ) {
    return '—';
  }

  if (voucher.referenceType === 'ic_purchase' || voucher.referenceType === 'metal_purchase' || voucher.referenceType === 'metal_purchase_aed' || voucher.referenceType === 'lab_test_purchase') {
    const p = purchases.find(x => x.id === id);
    return p ? getFormattedTxnId(p.id, 'purchase', p) : id.slice(0, 8);
  }

  if (voucher.referenceType === 'lab_test_sale') {
    const s = sales.find(x => x.id === id);
    return s ? getFormattedTxnId(s.id, 'sale', s) : id.slice(0, 8);
  }

  if (voucher.referenceType === 'ic_branch_deposit') {
    return id ? `DEP-${id.slice(0, 8)}` : '—';
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
    case 'ic_branch_deposit':
      return 5;
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
    case 'metal_fx_profit':
      return 24;
    default:
      return 50;
  }
}

function journalSortInstant(row: Pick<ICFundVoucher, 'voucherDate' | 'voucherNo' | 'createdAt'>): number {
  const ts = Date.parse(String(row.createdAt || ''));
  if (Number.isFinite(ts)) return ts;
  const day = Date.parse(`${String(row.voucherDate || '').slice(0, 10)}T00:00:00Z`);
  if (Number.isFinite(day)) return day;
  return 0;
}

/** Newest posting first (flat list — e.g. server merge before grouping). */
export function sortDealJournals<T extends Pick<ICFundVoucher, 'voucherDate' | 'voucherNo' | 'createdAt' | 'referenceType'>>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const tb = journalSortInstant(b);
    const ta = journalSortInstant(a);
    if (tb !== ta) return tb - ta;
    return (b.voucherNo || 0) - (a.voucherNo || 0);
  });
}

/** Story order within one purchase/sale (buy → agent → COGS → profit). */
export function sortJournalsWithinDealGroup<T extends Pick<ICFundVoucher, 'voucherNo' | 'referenceType'>>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const ra = journalStoryRank(a.referenceType);
    const rb = journalStoryRank(b.referenceType);
    if (ra !== rb) return ra - rb;
    return (a.voucherNo || 0) - (b.voucherNo || 0);
  });
}

function warehouseDealGroupKey(voucher: Pick<ICFundVoucher, 'id' | 'referenceType' | 'referenceId'>): string {
  const ref = voucher.referenceType;
  const id = journalDealEntityId(voucher.referenceId);
  if (id && ref && WAREHOUSE_DEAL_REFERENCE_TYPES.has(ref)) return `deal:${id}`;
  return `voucher:${voucher.id}`;
}

export function warehouseJournalGroupHeadline(
  lines: ICFundVoucher[],
  purchases: ICPurchase[],
  sales: ICSale[],
): string {
  const refId = lines.find(l => l.referenceId)?.referenceId;
  if (refId) {
    const purchase = purchases.find(x => x.id === refId);
    if (purchase) {
      return isMetal(purchase.settlementMode) ? 'Bought metal' : 'IC purchase';
    }
    const sale = sales.find(x => x.id === refId);
    if (sale) {
      return isMetal(sale.settlementMode) ? 'Sold metal' : 'Sold IC';
    }
    if (lines.some(l => l.referenceType === 'ic_branch_deposit')) {
      return 'Customer deposit';
    }
  }
  const first = lines[0];
  return first ? warehouseJournalEntryLabel(first, purchases, sales) : '—';
}

export type WarehouseJournalDealGroup = {
  key: string;
  lines: ICFundVoucher[];
  latestAt: string;
  dealRef: string;
  headline: string;
};

export function groupWarehouseDealJournals(
  rows: ICFundVoucher[],
  purchases: ICPurchase[],
  sales: ICSale[],
): WarehouseJournalDealGroup[] {
  const map = new Map<string, ICFundVoucher[]>();
  for (const row of rows) {
    const key = warehouseDealGroupKey(row);
    const bucket = map.get(key) ?? [];
    bucket.push(row);
    map.set(key, bucket);
  }

  const groups: WarehouseJournalDealGroup[] = [];
  for (const [key, rawLines] of map) {
    const lines = sortJournalsWithinDealGroup(rawLines);
    const latestAt = lines.reduce((max, line) => {
      const t = journalSortInstant(line);
      return t > max ? t : max;
    }, 0);
    const sample = lines[0];
    groups.push({
      key,
      lines,
      latestAt: latestAt ? new Date(latestAt).toISOString() : sample?.createdAt || sample?.voucherDate || '',
      dealRef: sample ? warehouseJournalDealRef(sample, purchases, sales) : '—',
      headline: warehouseJournalGroupHeadline(lines, purchases, sales),
    });
  }

  groups.sort((a, b) => {
    const tb = Date.parse(b.latestAt) || journalSortInstant(b.lines[0] ?? ({} as ICFundVoucher));
    const ta = Date.parse(a.latestAt) || journalSortInstant(a.lines[0] ?? ({} as ICFundVoucher));
    return tb - ta;
  });
  return groups;
}
