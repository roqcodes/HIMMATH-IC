import { DEFAULT_RATES, getLiveCurrencyRates, isCurrencyCode } from '@/lib/currency';
import type { ICRateGroup } from '@/types';

/** Max fractional digits for IC rate inputs / storage display. */
export const RATE_DECIMAL_PLACES = 14;

/** Sale rate on rate groups is always AED per unit. */
export function getCurrencyUnitRate(saleRateAed: number, conversionRate: number = 1): number {
  return saleRateAed * conversionRate;
}

export function deriveConversionRate(saleRateAed: number, convertedRate: number): number | null {
  if (!Number.isFinite(saleRateAed) || saleRateAed <= 0 || !Number.isFinite(convertedRate)) return null;
  return convertedRate / saleRateAed;
}

export function deriveConvertedRate(saleRateAed: number, conversionRate: number): number | null {
  if (!Number.isFinite(saleRateAed) || !Number.isFinite(conversionRate)) return null;
  return getCurrencyUnitRate(saleRateAed, conversionRate);
}

/**
 * Format a derived rate for an input field.
 * Keeps up to `fractionDigits` decimals without forcing trailing zeros or early rounding.
 */
export function formatRateInputValue(
  value: number,
  fractionDigits: number = RATE_DECIMAL_PLACES,
): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return '0';

  // Avoid scientific notation; trim binary float noise beyond the allowed precision.
  const fixed = value.toFixed(fractionDigits);
  if (!fixed.includes('.')) return fixed;
  return fixed.replace(/(\.\d*?[1-9])0+$/u, '$1').replace(/\.0+$/u, '');
}

export function parseRateInputValue(value: string): number | null {
  if (value.trim() === '') return null;
  // Allow intermediate typing states like "3." or "0."
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
  conversionRate: number = 1,
  serviceCharge: number = 0,
) {
  const aedBaseTotal = units * saleRateAed;
  const aedNetTotal = Math.max(0, aedBaseTotal - serviceCharge);
  const currencyTotal = aedBaseTotal * conversionRate;
  const inrTotal = units * 1000;

  return {
    saleRateAed,
    conversionRate,
    currencyUnitRate: getCurrencyUnitRate(saleRateAed, conversionRate),
    aedBaseTotal,
    aedNetTotal,
    currencyTotal,
    inrTotal,
  };
}

export type SaleCurrencySource = 'customer_aed' | 'rate_group' | 'live_fx';

export type SaleCurrencyContext = {
  currency: string;
  conversionRate: number;
  source: SaleCurrencySource;
  /** Registered customer selected but profile currency is missing or invalid. */
  needsCustomerCurrency: boolean;
  /** Customer profile currency differs from the applied rate group currency. */
  fxFallbackWarning?: string;
  /** Walk-in name with no linked customer profile. */
  unregisteredCustomerWarning?: string;
};

const PLACEHOLDER_CURRENCY_LABELS = new Set(['', 'CURRENCY']);

/** Normalize customer / rate-group currency codes; null when unset or invalid. */
export function normalizeSaleCurrencyCode(value?: string | null): string | null {
  if (value == null) return null;
  const upper = value.trim().toUpperCase();
  if (PLACEHOLDER_CURRENCY_LABELS.has(upper)) return null;
  return isCurrencyCode(upper) ? upper : null;
}

function liveFxRateForCurrency(currency: string): number | null {
  const rate = getLiveCurrencyRates()[currency] ?? DEFAULT_RATES[currency];
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return null;
  return rate;
}

/**
 * Resolve sale display/storage currency.
 * Priority: (1) applicable rate group, (2) registered customer profile, (3) AED.
 */
export function resolveSaleCurrencyContext(options: {
  customerId?: string | null;
  customerCurrency?: string | null;
  rateGroup?: ICRateGroup;
}): SaleCurrencyContext {
  const { customerId, customerCurrency, rateGroup } = options;
  const hasRegisteredCustomer = Boolean(customerId?.trim());

  const groupCur = normalizeSaleCurrencyCode(rateGroup?.currency);
  const groupRate = rateGroup?.conversionRate;
  const hasRateGroupFx =
    Boolean(rateGroup) &&
    Boolean(groupCur) &&
    groupRate != null &&
    Number.isFinite(groupRate) &&
    groupRate > 0;

  if (hasRateGroupFx && groupCur) {
    const customerCur = hasRegisteredCustomer
      ? normalizeSaleCurrencyCode(customerCurrency)
      : null;
    const conversionRate = groupCur === 'AED' ? 1 : Number(groupRate);
    return {
      currency: groupCur,
      conversionRate,
      source: 'rate_group',
      needsCustomerCurrency: false,
      fxFallbackWarning:
        customerCur && customerCur !== groupCur
          ? `Sale uses rate group currency ${groupCur} (customer profile: ${customerCur}).`
          : undefined,
      unregisteredCustomerWarning: hasRegisteredCustomer
        ? undefined
        : 'Walk-in sale — using rate group currency for conversion.',
    };
  }

  if (hasRegisteredCustomer) {
    const customerCur = normalizeSaleCurrencyCode(customerCurrency);
    if (!customerCur) {
      return {
        currency: 'AED',
        conversionRate: 1,
        source: 'customer_aed',
        needsCustomerCurrency: true,
      };
    }

    if (customerCur === 'AED') {
      return {
        currency: 'AED',
        conversionRate: 1,
        source: 'customer_aed',
        needsCustomerCurrency: false,
      };
    }

    const liveRate = liveFxRateForCurrency(customerCur);
    if (liveRate != null) {
      return {
        currency: customerCur,
        conversionRate: liveRate,
        source: 'live_fx',
        needsCustomerCurrency: false,
      };
    }

    return {
      currency: customerCur,
      conversionRate: 1,
      source: 'live_fx',
      needsCustomerCurrency: false,
      fxFallbackWarning: `No exchange rate for ${customerCur}; converted amount equals AED total.`,
    };
  }

  return {
    currency: 'AED',
    conversionRate: 1,
    source: 'customer_aed',
    needsCustomerCurrency: false,
    unregisteredCustomerWarning:
      'Select a registered customer or assign a rate group to apply foreign currency conversion.',
  };
}

export function resolveApplicableRateGroup(
  groups: ICRateGroup[],
  options: { branchId?: string; customerId?: string },
): ICRateGroup | undefined {
  const { branchId, customerId } = options;
  if (customerId) {
    const byCustomer = groups.find(g => g.customerIds?.includes(customerId));
    if (byCustomer) return byCustomer;
  }
  if (branchId) {
    return groups.find(g => g.branchIds?.includes(branchId));
  }
  return undefined;
}

export function formatAmount(value: number, fractionDigits = 2): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Display rates with up to 14 decimals (no forced trailing zeros). */
export function formatRateAmount(
  value: number,
  maxFractionDigits: number = RATE_DECIMAL_PLACES,
): string {
  if (!Number.isFinite(value)) return '';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
    useGrouping: false,
  });
}
