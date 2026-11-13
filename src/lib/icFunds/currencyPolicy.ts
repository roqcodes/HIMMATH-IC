/** Company / ledger base currency — all IC Funds voucher amounts are stored in this unit. */
export const IC_FUNDS_BASE_CURRENCY = 'AED';

/** Stored / computed money precision (AED, INR ledger amounts). */
export const LEDGER_MONEY_DECIMAL_PLACES = 2;

/** FX / rate fields may use higher precision. */
export const LEDGER_RATE_DECIMAL_PLACES = 14;

/** @deprecated use LEDGER_MONEY_DECIMAL_PLACES */
export const LEDGER_DECIMAL_PLACES = LEDGER_MONEY_DECIMAL_PLACES;

/** Half-up away from zero (commercial rounding). */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** LEDGER_MONEY_DECIMAL_PLACES;
  const sign = value < 0 ? -1 : 1;
  const scaled = Math.abs(value) * factor;
  const rounded = Math.floor(scaled + 0.5 + Number.EPSILON);
  return (sign * rounded) / factor;
}

export function roundLedgerAmount(value: number): number {
  return roundMoney(value);
}

export function roundLedgerRate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(LEDGER_RATE_DECIMAL_PLACES));
}

export type AccountCurrencyRow = {
  account_type: string;
  currency?: unknown;
};

export function normalizeAccountCurrency(_value?: unknown): string {
  return IC_FUNDS_BASE_CURRENCY;
}

/** All accounts and vouchers are AED-only. */
export function validateVoucherCurrencyPolicy(
  _debit: AccountCurrencyRow,
  _credit: AccountCurrencyRow,
): string | null {
  return null;
}
