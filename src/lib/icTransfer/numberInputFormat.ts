import { formatRateInputValue, RATE_DECIMAL_PLACES } from '@/lib/icTransfer/rateCalculations';

/** Strip grouping and parse; returns 0 for empty / invalid partials so parents stay stable. */
export function parseGroupedNumberInput(raw: string): number {
  const cleaned = raw.replace(/,/g, '').trim();
  if (cleaned === '' || cleaned === '-' || cleaned === '+' || cleaned === '.') return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const LOCALE_AED = 'en-US';
const LOCALE_INR = 'en-IN';

export type NumericInputBook = 'aed' | 'inr';

export function numericInputLocale(book: NumericInputBook): string {
  return book === 'inr' ? LOCALE_INR : LOCALE_AED;
}

/** Blurred display: thousands / Indian grouping. */
export function formatNumericInputDisplay(
  n: number,
  book: NumericInputBook,
  maxFractionDigits: number,
): string {
  if (!Number.isFinite(n) || n === 0) return '';
  return n.toLocaleString(numericInputLocale(book), {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: 0,
  });
}

/** Focused editing: no commas; trims trailing zeros like rate fields. */
export function formatNumericInputPlain(n: number, maxFractionDigits: number = RATE_DECIMAL_PLACES): string {
  if (!Number.isFinite(n) || n === 0) return '';
  return formatRateInputValue(n, maxFractionDigits);
}
