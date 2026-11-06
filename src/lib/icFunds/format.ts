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

type LedgerColumnKey =
  | 'amount'
  | 'debit'
  | 'credit'
  | 'balance'
  | 'opening'
  | 'period'
  | 'pendingDr'
  | 'pendingCr'
  | 'revenue'
  | 'cogs'
  | 'grossProfit'
  | 'profit'
  | 'avgCost'
  | 'saleRate';

const LEDGER_COLUMN_STEM: Record<LedgerColumnKey, string> = {
  amount: 'Amount',
  debit: 'Debit',
  credit: 'Credit',
  balance: 'Balance',
  opening: 'Opening',
  period: 'Period',
  pendingDr: 'Pending Dr',
  pendingCr: 'Pending Cr',
  revenue: 'Revenue',
  cogs: 'COGS',
  grossProfit: 'Gross profit',
  profit: 'Profit',
  avgCost: 'Avg cost',
  saleRate: 'Sale rate',
};

export function icfLedgerColumnLabelFor(
  book: 'AED' | 'INR' = 'AED',
): Record<LedgerColumnKey, string> {
  const suffix = book === 'INR' ? 'INR' : 'AED';
  return {
    amount: `${LEDGER_COLUMN_STEM.amount} (${suffix})`,
    debit: `${LEDGER_COLUMN_STEM.debit} (${suffix})`,
    credit: `${LEDGER_COLUMN_STEM.credit} (${suffix})`,
    balance: `${LEDGER_COLUMN_STEM.balance} (${suffix})`,
    opening: `${LEDGER_COLUMN_STEM.opening} (${suffix})`,
    period: `${LEDGER_COLUMN_STEM.period} (${suffix})`,
    pendingDr: `${LEDGER_COLUMN_STEM.pendingDr} (${suffix})`,
    pendingCr: `${LEDGER_COLUMN_STEM.pendingCr} (${suffix})`,
    revenue: `${LEDGER_COLUMN_STEM.revenue} (${suffix})`,
    cogs: `${LEDGER_COLUMN_STEM.cogs} (${suffix})`,
    grossProfit: `${LEDGER_COLUMN_STEM.grossProfit} (${suffix})`,
    profit: `${LEDGER_COLUMN_STEM.profit} (${suffix})`,
    avgCost: `${LEDGER_COLUMN_STEM.avgCost} (${suffix})`,
    saleRate: `${LEDGER_COLUMN_STEM.saleRate} (${suffix})`,
  };
}

/** AED fund ledger column titles (default). Use `icfLedgerColumnLabelFor('INR')` on the INR book. */
export const icfLedgerColumnLabel = icfLedgerColumnLabelFor('AED');

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
