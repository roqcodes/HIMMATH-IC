import { IC_FUNDS_BASE_CURRENCY } from '@/lib/icFunds/currencyPolicy';
import { formatAmount } from '@/lib/icTransfer/rateCalculations';

export function fmtICAmount(n: number): string {
  return formatAmount(n);
}

/** Ledger amounts (AED-only app — no currency suffix in UI). */
export function fmtLedgerAed(n: number): string {
  return fmtICAmount(n);
}

/** Foreign amount with ISO currency code (wallet / FX layer). */
export function fmtForeignAmount(n: number, currency: string): string {
  const code = String(currency || IC_FUNDS_BASE_CURRENCY).trim().toUpperCase();
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
