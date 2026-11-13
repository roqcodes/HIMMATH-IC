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

/** Live draft: locale grouping while typing; preserves trailing "." and partial decimals. */
export function formatGroupedNumberInputDraft(
  raw: string,
  book: NumericInputBook,
  maxFractionDigits: number,
): string {
  const cleaned = raw.replace(/,/g, '');
  if (cleaned === '' || cleaned === '+' ) return '';
  if (cleaned === '-') return '-';

  const negative = cleaned.startsWith('-');
  let unsigned = negative ? cleaned.slice(1) : cleaned;
  unsigned = unsigned.replace(/[^\d.]/g, '');
  const firstDot = unsigned.indexOf('.');
  if (firstDot !== -1) {
    unsigned = unsigned.slice(0, firstDot + 1) + unsigned.slice(firstDot + 1).replace(/\./g, '');
  }

  if (unsigned === '') return negative ? '-' : '';

  const dotIndex = unsigned.indexOf('.');
  const intRaw = dotIndex === -1 ? unsigned : unsigned.slice(0, dotIndex);
  const fracRaw = dotIndex === -1 ? '' : unsigned.slice(dotIndex + 1);
  const hasTrailingDot = dotIndex !== -1 && fracRaw === '' && unsigned.endsWith('.');

  const intDigits = intRaw.replace(/\D/g, '');
  const fracDigits = fracRaw.replace(/\D/g, '').slice(0, maxFractionDigits);

  const locale = numericInputLocale(book);
  const prefix = negative ? '-' : '';
  const formattedInt =
    intDigits === ''
      ? ''
      : Number(intDigits).toLocaleString(locale, { maximumFractionDigits: 0, useGrouping: true });

  if (dotIndex === -1) {
    return prefix + (formattedInt || intDigits);
  }

  if (hasTrailingDot) {
    const head = formattedInt || (intDigits === '' ? '0' : intDigits);
    return `${prefix}${head}.`;
  }

  const head = formattedInt || (intDigits === '' ? '0' : intDigits);
  return fracDigits === '' ? `${prefix}${head}` : `${prefix}${head}.${fracDigits}`;
}

/** Digits strictly before index (for caret restore after grouping). */
export function digitOffsetBefore(value: string, caret: number): number {
  let n = 0;
  const end = Math.min(caret, value.length);
  for (let i = 0; i < end; i += 1) {
    if (/\d/u.test(value[i]!)) n += 1;
  }
  return n;
}

export function caretIndexAfterDigits(formatted: string, digitOffset: number): number {
  if (digitOffset <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (/\d/u.test(formatted[i]!)) {
      seen += 1;
      if (seen === digitOffset) return i + 1;
    }
  }
  return formatted.length;
}

/** Map caret through grouping + decimal so "." stays under the cursor while typing. */
export function mapCaretThroughNumericFormat(
  raw: string,
  formatted: string,
  rawCaret: number,
): number {
  const cleaned = raw.replace(/,/g, '');
  const before = cleaned.slice(0, Math.max(0, Math.min(rawCaret, cleaned.length)));
  const dotInBefore = before.indexOf('.');
  const intDigitCount = (
    dotInBefore === -1 ? before : before.slice(0, dotInBefore)
  ).replace(/\D/g, '').length;
  const fracDigitCount =
    dotInBefore === -1 ? 0 : before.slice(dotInBefore + 1).replace(/\D/g, '').length;

  const fmtDot = formatted.indexOf('.');

  if (dotInBefore === -1) {
    return caretIndexAfterDigits(formatted, intDigitCount);
  }

  if (fmtDot === -1) {
    return formatted.length;
  }

  if (fracDigitCount === 0) {
    return fmtDot + 1;
  }

  return caretIndexAfterDigits(formatted, intDigitCount + fracDigitCount);
}
