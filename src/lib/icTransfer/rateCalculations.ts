import type { ICRateGroup } from '@/types';
import { resolveGroupOrderRate } from './ratePricing';
import { normalizeICSaleTransactionType } from './transactionTypes';

/** Max fractional digits for IC rate inputs / storage display. */
export const RATE_DECIMAL_PLACES = 14;

/** 1 IC unit = 1 lakh INR = 100,000. */
export const INR_PER_UNIT = 100_000;

/**
 * Cash IC sheet: **AED = units × RATE** (RATE ~36, same field they type on metal).
 * Example: 50 units × 36.2 = 1,810 AED.
 */
export function computeIcCashAedTotal(units: number, unitRateAed: number): number {
  const u = Number(units);
  const r = Number(unitRateAed);
  if (!Number.isFinite(u) || u <= 0 || !Number.isFinite(r) || r <= 0) return 0;
  return Number((u * r).toFixed(4));
}

/** Implied cash RATE from units and AED (AED ÷ units). */
export function computeIcCashRateFromTotals(units: number, aedTotal: number): number {
  const u = Number(units);
  if (!Number.isFinite(u) || u <= 0) return 0;
  const aed = Number(aedTotal);
  if (!Number.isFinite(aed) || aed <= 0) return 0;
  return Number((aed / u).toFixed(4));
}

export function formatAmount(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatRateAmount(value: number): string {
  return formatRateInputValue(value);
}

export function formatRateInputValue(
  value: number,
  fractionDigits: number = RATE_DECIMAL_PLACES,
): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return '0';
  const fixed = value.toFixed(fractionDigits);
  if (!fixed.includes('.')) return fixed;
  return fixed.replace(/(\.\d*?[1-9])0+$/u, '$1').replace(/\.0+$/u, '');
}

export function parseRateInputValue(value: string): number | null {
  if (value.trim() === '') return null;
  if (/^-?\d+\.$/u.test(value.trim())) {
    const whole = parseFloat(value);
    return Number.isFinite(whole) ? whole : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function computeICSaleAmounts(
  units: number,
  saleRateAed: number,
  serviceCharge: number = 0,
) {
  const inrTotal = units * INR_PER_UNIT;
  const aedBaseTotal = computeIcCashAedTotal(units, saleRateAed);
  const aedNetTotal = Math.max(0, aedBaseTotal - serviceCharge);

  return {
    saleRateAed,
    aedBaseTotal,
    aedNetTotal,
    inrTotal,
  };
}

/** AED sale rate from a rate group (flat or pricing config for transaction type). */
export function resolveGroupSaleRateAed(
  group: Pick<ICRateGroup, 'saleRate' | 'pricingConfig'> | null | undefined,
  transactionType?: string | null,
): number {
  if (!group) return 0;
  return resolveGroupOrderRate(group, normalizeICSaleTransactionType(transactionType), 0).saleRate;
}

/** Foreign/local unit rate derived from AED sale rate × conversion (pricing slabs only). */
export function getCurrencyUnitRate(saleRateAed: number, conversionRate: number = 1): number {
  const conv = conversionRate > 0 ? conversionRate : 1;
  return saleRateAed * conv;
}

export function deriveConversionRate(saleRateAed: number, convertedRate: number): number | null {
  if (!Number.isFinite(saleRateAed) || saleRateAed <= 0) return null;
  if (!Number.isFinite(convertedRate) || convertedRate <= 0) return null;
  return convertedRate / saleRateAed;
}

export function deriveConvertedRate(saleRateAed: number, conversionRate: number): number | null {
  if (!Number.isFinite(saleRateAed) || saleRateAed <= 0) return null;
  if (!Number.isFinite(conversionRate) || conversionRate <= 0) return null;
  return saleRateAed * conversionRate;
}

export function resolveApplicableRateGroup(
  groups: ICRateGroup[],
  opts: { branchId?: string; customerId?: string },
): ICRateGroup | undefined {
  if (opts.customerId) {
    return groups.find(g => g.customerIds?.includes(opts.customerId!));
  }
  return groups[0];
}

export function resolveSaleCurrencyContext(_opts: {
  customerId?: string;
  customerCurrency?: string | null;
  rateGroup?: ICRateGroup | null;
}) {
  return {
    currency: 'AED',
    conversionRate: 1,
    source: 'default' as const,
    needsCustomerCurrency: false,
  };
}
