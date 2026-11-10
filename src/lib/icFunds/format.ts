import { fmtLedgerAedPlain, fmtLedgerInrPlain } from '@/components/currency/CurrencyAmount';
import { IC_FUNDS_BASE_CURRENCY } from '@/lib/icFunds/currencyPolicy';
import { formatAmount } from '@/lib/icTransfer/rateCalculations';

export { fmtLedgerAedPlain, fmtLedgerInrPlain, fmtLedgerAmountPlain } from '@/components/currency/CurrencyAmount';
export { FmtLedgerAed, FmtLedgerInr, FmtLedgerAmount } from '@/components/currency/CurrencyAmount';

export function fmtICAmount(n: number): string {
  return formatAmount(n);
}

/** Plain-text ledger AED (tooltips, hints, CSV). */
export function fmtLedgerAed(n: number): string {
  return fmtLedgerAedPlain(n);
}

export function fmtLedgerInr(n: number): string {
  return fmtLedgerInrPlain(n);
}

export function fmtLedgerAmount(n: number, book: 'AED' | 'INR' | undefined): string {
  return book === 'INR' ? fmtLedgerInr(n) : fmtLedgerAed(n);
}

export const icfLedgerColumnLabel = {
  amount: 'Amount (AED)',
  debit: 'Debit (AED)',
  credit: 'Credit (AED)',
  balance: 'Balance (AED)',
  opening: 'Opening (AED)',
  period: 'Period (AED)',
  pendingDr: 'Pending Dr (AED)',
  pendingCr: 'Pending Cr (AED)',
  revenue: 'Revenue (AED)',
  cogs: 'COGS (AED)',
  grossProfit: 'Gross profit (AED)',
  profit: 'Profit (AED)',
  avgCost: 'Avg cost (AED)',
  saleRate: 'Sale rate (AED)',
} as const;

const ICF_LEDGER_COLUMN_INR_SUFFIX = 'INR' as const;

export function icfLedgerColumnLabelForBook(book: 'AED' | 'INR') {
  if (book === 'AED') return icfLedgerColumnLabel;
  const tag = `(${ICF_LEDGER_COLUMN_INR_SUFFIX})`;
  return {
    amount: `Amount ${tag}`,
    debit: `Debit ${tag}`,
    credit: `Credit ${tag}`,
    balance: `Balance ${tag}`,
    opening: `Opening ${tag}`,
    period: `Period ${tag}`,
    pendingDr: `Pending Dr ${tag}`,
    pendingCr: `Pending Cr ${tag}`,
    revenue: `Revenue ${tag}`,
    cogs: `COGS ${tag}`,
    grossProfit: `Gross profit ${tag}`,
    profit: `Profit ${tag}`,
    avgCost: `Avg cost ${tag}`,
    saleRate: `Sale rate ${tag}`,
  };
}

/** Foreign amount with ISO currency code (wallet / FX layer). */
export function fmtForeignAmount(n: number, currency: string): string {
  const code = String(currency || IC_FUNDS_BASE_CURRENCY).trim().toUpperCase();
  if (code === 'AED') return fmtLedgerAed(n);
  if (code === 'INR') return fmtLedgerInr(n);
  return `${formatAmount(n)} ${code}`;
}

export function fmtICDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y.slice(2)}`;
}

export function todayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function voucherUserLabel(voucher: {
  createdByName?: string;
  createdBy?: string;
}): string {
  const name = voucher.createdByName?.trim();
  if (name) return name;
  const by = voucher.createdBy?.trim();
  if (by) return by;
  return '—';
}

export function fmtICTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
