/** ISO 4217 three-letter currency code. Ledger and UI use AED only after HQ refactor. */
export type CurrencyCode = 'AED' | string;

export function sanitizeEnabledCurrencies(_input?: unknown): CurrencyCode[] {
  return ['AED'];
}

export function isCurrencyCode(value: string): value is CurrencyCode {
  return /^[A-Z]{3}$/.test(value);
}

/** Legacy no-op — amounts are already in AED. */
export function convertFromAed(amountAed: number, _target?: CurrencyCode | string): number {
  return amountAed;
}

export function formatConvertedAmount(
  amountAed: number,
  currency: CurrencyCode | string = 'AED',
  options?: { showPlus?: boolean; suffix?: boolean },
): string {
  const absAmount = Math.abs(amountAed);
  const numStr = absAmount.toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  const sign = amountAed < 0 ? '-' : options?.showPlus && amountAed > 0 ? '+' : '';
  const suffix = options?.suffix !== false ? ` ${currency}` : '';
  return `${sign}${numStr}${suffix}`;
}
