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

export function normalizeAccountCurrency(value: unknown): string {
  const cur = String(value || IC_FUNDS_BASE_CURRENCY).trim().toUpperCase();
  return cur || IC_FUNDS_BASE_CURRENCY;
}

/** Account types that may carry a wallet/statement currency tag (ledger amounts stay AED). */
export const WALLET_TAG_ACCOUNT_TYPES = new Set(['collection_agent', 'personal']);

/**
 * Ledger entries are always in company base currency (AED).
 * Collection agents and personal customers may carry a foreign currency tag for wallet/FX/statement views.
 */
export function validateVoucherCurrencyPolicy(
  debit: AccountCurrencyRow,
  credit: AccountCurrencyRow,
): string | null {
  const debitCur = normalizeAccountCurrency(debit.currency);
  const creditCur = normalizeAccountCurrency(credit.currency);
  const debitType = String(debit.account_type);
  const creditType = String(credit.account_type);

  for (const [type, cur, side] of [
    [debitType, debitCur, 'Debit'],
    [creditType, creditCur, 'Credit'],
  ] as const) {
    if (!WALLET_TAG_ACCOUNT_TYPES.has(type) && cur !== IC_FUNDS_BASE_CURRENCY) {
      return `${side} account must be ${IC_FUNDS_BASE_CURRENCY}. Only collection agents and personal customers use a foreign currency tag (wallet layer). Ledger amounts are always ${IC_FUNDS_BASE_CURRENCY}.`;
    }
  }

  if (
    debitCur !== IC_FUNDS_BASE_CURRENCY &&
    creditCur !== IC_FUNDS_BASE_CURRENCY &&
    debitCur !== creditCur
  ) {
    return `Cannot post between ${debitCur} and ${creditCur} in one entry. Split into separate ${IC_FUNDS_BASE_CURRENCY} amounts.`;
  }

  return null;
}

export function accountWalletCurrency(account: {
  accountType: string;
  currency?: string | null;
}): string | null {
  const cur = normalizeAccountCurrency(account.currency);
  if (WALLET_TAG_ACCOUNT_TYPES.has(String(account.accountType)) && cur !== IC_FUNDS_BASE_CURRENCY) {
    return cur;
  }
  return null;
}

export function walletLedgerNote(walletCurrency: string): string {
  return `Wallet & statements use ${walletCurrency}. Ledger balance and voucher amounts on this account are in ${IC_FUNDS_BASE_CURRENCY}.`;
}

/** @deprecated Use walletLedgerNote */
export function collectionAgentLedgerNote(walletCurrency: string): string {
  return walletLedgerNote(walletCurrency);
}

/** Never sum unlike currencies — format per-currency totals for KPIs. */
export function formatCurrencyBreakdown(
  totals: Record<string, number>,
  formatAmount: (n: number) => string,
): { display: string; isMixed: boolean; currencies: string[] } {
  const entries = Object.entries(totals)
    .filter(([, v]) => Math.abs(v) > 1e-10)
    .sort((a, b) => b[1] - a[1]);
  const currencies = entries.map(([c]) => c);
  if (entries.length === 0) {
    return { display: `0 ${IC_FUNDS_BASE_CURRENCY}`, isMixed: false, currencies: [] };
  }
  if (entries.length === 1) {
    return {
      display: `${formatAmount(entries[0][1])} ${entries[0][0]}`,
      isMixed: false,
      currencies,
    };
  }
  return {
    display: entries.map(([cur, amt]) => `${formatAmount(amt)} ${cur}`).join(' · '),
    isMixed: true,
    currencies,
  };
}

export function aggregateByCurrency<T>(
  items: T[],
  getCurrency: (item: T) => string,
  getAmount: (item: T) => number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const cur = normalizeAccountCurrency(getCurrency(item));
    out[cur] = (out[cur] || 0) + getAmount(item);
  }
  return out;
}
