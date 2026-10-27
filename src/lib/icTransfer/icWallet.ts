/**
 * Foreign-currency wallet layer (customer ↔ collection agent).
 * Step 2 of FX flow: SAR moves between wallets with FIFO sale allocation.
 * AED IC Funds ledger is unchanged until FX settlement (step 3).
 */

import {
  FX_CALC_DECIMAL_PLACES,
  formatFxAmount,
  roundFxCalc,
  sortSalesFifo,
  salesWithRemainingBalance,
  type FxOpenSaleLine,
} from '@/lib/icTransfer/saleFxProfit';

export type WalletPaymentAllocation = {
  saleId: string | null;
  allocatedForeign: number;
  saleConversionRate: number | null;
};

export type WalletSaleAllocationRow = {
  saleId: string;
  customerId: string;
  collectionAccountId: string;
  allocatedForeign: number;
  settledForeign: number;
  saleConversionRate: number;
  walletTransactionId: string;
  allocationId: string;
};

export const WALLET_FOREIGN_DECIMAL_PLACES = FX_CALC_DECIMAL_PLACES;
export const WALLET_RATE_DECIMAL_PLACES = FX_CALC_DECIMAL_PLACES;

export function roundWalletForeign(value: number): number {
  return roundFxCalc(value);
}

export function roundWalletRate(value: number): number {
  return roundFxCalc(value);
}

/** FIFO across open sales; leftover is unapplied credit for later deals. */
export function buildFifoWalletPaymentAllocations(
  salesOrdered: FxOpenSaleLine[],
  totalPaidForeign: number,
): WalletPaymentAllocation[] {
  const paid = Number(totalPaidForeign);
  if (!Number.isFinite(paid) || paid <= 0) {
    throw new Error('Paid amount must be greater than zero');
  }

  const active = sortSalesFifo(salesWithRemainingBalance(salesOrdered));
  let pool = paid;
  const allocs: WalletPaymentAllocation[] = [];
  for (const sale of active) {
    if (pool <= 1e-10) break;
    const applied = roundFxCalc(Math.min(pool, sale.foreignRemaining));
    if (applied <= 1e-10) continue;
    allocs.push({
      saleId: sale.saleId,
      allocatedForeign: applied,
      saleConversionRate: sale.conversionRate,
    });
    pool = roundFxCalc(pool - applied);
  }

  if (pool > 1e-10) {
    allocs.push({
      saleId: null,
      allocatedForeign: pool,
      saleConversionRate: null,
    });
  }

  if (allocs.length === 0) {
    throw new Error('Paid amount must be greater than zero');
  }
  return allocs;
}

/** Agent foreign balance = approved allocations in − settled − transfers out. */
export function computeAgentForeignBalance(
  allocations: WalletSaleAllocationRow[],
  settledByAllocationId: Map<string, number>,
  transfersOut: number,
): number {
  const held = allocations.reduce((sum, row) => {
    const settled = settledByAllocationId.get(row.allocationId) ?? row.settledForeign;
    return sum + Math.max(0, row.allocatedForeign - settled);
  }, 0);
  return roundFxCalc(Math.max(0, held - transfersOut));
}

export function computeCustomerForeignRemaining(sales: FxOpenSaleLine[]): number {
  return roundFxCalc(salesWithRemainingBalance(sales).reduce((s, row) => s + row.foreignRemaining, 0));
}

export function validateWalletPaymentAmount(_sales: FxOpenSaleLine[], paidForeign: number): void {
  const paid = Number(paidForeign);
  if (!Number.isFinite(paid) || paid <= 0) {
    throw new Error('Paid amount must be greater than zero');
  }
}

export function normalizeAccountCurrency(currency?: string | null): string {
  const cur = String(currency || 'AED').trim().toUpperCase();
  return cur || 'AED';
}

export function assertCurrencyMatch(
  label: string,
  expected: string,
  actual: string,
): void {
  if (normalizeAccountCurrency(expected) !== normalizeAccountCurrency(actual)) {
    throw new Error(`${label} currency must be ${expected}, got ${actual}`);
  }
}

export const WALLET_TRANSACTION_TYPES = ['customer_payment', 'agent_transfer'] as const;

export function formatWalletTxnId(transactionNo: number): string {
  if (!Number.isFinite(transactionNo) || transactionNo <= 0) return '';
  return `IC-WL-${String(Math.trunc(transactionNo)).padStart(5, '0')}`;
}
export type WalletTransactionType = (typeof WALLET_TRANSACTION_TYPES)[number];

export const WALLET_TRANSACTION_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type WalletTransactionStatus = (typeof WALLET_TRANSACTION_STATUSES)[number];

export { FX_CALC_DECIMAL_PLACES, formatFxAmount, roundFxCalc };
