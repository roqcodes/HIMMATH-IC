/** Company / ledger base currency — all IC Funds voucher amounts are stored in this unit. */
export const IC_FUNDS_BASE_CURRENCY = 'AED';

/** Full precision for ledger math (UI shows up to 4 decimals). */
export const LEDGER_DECIMAL_PLACES = 14;

export function roundLedgerAmount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(LEDGER_DECIMAL_PLACES));
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
