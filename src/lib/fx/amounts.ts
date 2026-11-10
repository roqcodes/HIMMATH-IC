import { roundLedgerAmount, roundLedgerRate } from '@/lib/icFunds/currencyPolicy';

export const CURRENCY_EXCHANGE_REF = 'currency_exchange';

export type FxDirection = 'aed_to_inr' | 'inr_to_aed';

export function computeCurrencyExchangeAmounts(
  direction: FxDirection,
  sourceAmount: number,
  inrPerAed: number,
): { aed: number; inr: number } {
  const src = roundLedgerAmount(sourceAmount);
  const rate = roundLedgerRate(inrPerAed);
  if (src <= 0 || rate <= 0) return { aed: 0, inr: 0 };
  if (direction === 'aed_to_inr') {
    return { aed: src, inr: roundLedgerAmount(src * rate) };
  }
  return { inr: src, aed: roundLedgerAmount(src / rate) };
}
