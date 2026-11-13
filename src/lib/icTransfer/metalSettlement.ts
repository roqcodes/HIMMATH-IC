import { roundMoney, LEDGER_MONEY_DECIMAL_PLACES } from '@/lib/icFunds/currencyPolicy';
import { computeIcCashAedTotal, computeIcCashRateFromTotals, INR_PER_UNIT } from './rateCalculations';
import { netMetalInr } from '@/lib/icTransfer/labTest';
import {
  isMetalAedPayment,
  isMetalSplitPayment,
  needsMetalAedAgent,
  normalizeMetalPaymentMethod,
  type MetalPaymentMethod,
} from '@/lib/domain/books';
import {
  assertSplitAmounts,
  finalizeSplitAmounts,
  type MetalSplitAmounts,
} from '@/lib/icTransfer/metalSplit';

export const IC_SETTLEMENT_MODES = ['cash', 'metal'] as const;
export type ICSettlementMode = (typeof IC_SETTLEMENT_MODES)[number];

export const METAL_WEIGHT_DECIMALS = 4;
export const METAL_AMOUNT_DECIMALS = LEDGER_MONEY_DECIMAL_PLACES;
export const IC_QUANTITY_DECIMAL_PLACES = 4;
export const IC_RATE_DECIMAL_PLACES = 4;

/**
 * Metal sheet RATE (~36, same range as cash IC): **AED = INR × RATE ÷ 1,000**.
 * Example: 6,995,940 × 36.35 ÷ 1,000 = 254,302.42.
 */
export const METAL_AED_RATE_DIVISOR = 1_000;

export type MetalSettlementInput = {
  metalWeightG: number;
  metalRateInrPerG: number;
  metalRateAedPerG: number;
  totalInr: number;
  totalAed: number;
  labTotalInr?: number;
};

export type MetalSettlementFields = {
  metalWeightG: number;
  metalRateInrPerG: number;
  /** Sheet RATE: AED = INR × rate ÷ 1000 (same ~36 range as cash IC unit rate). */
  metalSheetRateAed: number;
  /** Implied AED per gram, stored on the row. */
  metalRateAedPerG: number;
  inrTotal: number;
  aedTotal: number;
  /** Legacy: unit mode used per-IC-unit rate on sales; prefer sheet formula everywhere. */
  aedRateMode?: 'sheet' | 'unit';
};

export type NormalizedCashPurchase = {
  settlementMode: 'cash';
  units: number;
  unitRate: number;
  aedTotal: number;
  inrTotal: null;
  metalWeightG: null;
  metalRateInrPerG: null;
  metalRateAedPerG: null;
};

export type NormalizedMetalPurchase = {
  settlementMode: 'metal';
  units: number;
  unitRate: number;
  aedTotal: number | null;
  inrTotal: number;
  metalWeightG: number;
  metalRateInrPerG: number;
  metalRateAedPerG: number;
  metalPaymentMethod: MetalPaymentMethod;
  aedAgentId?: string | null;
  splitInrPaid?: number | null;
  splitAedPaid?: number | null;
};

export type NormalizedPurchase = NormalizedCashPurchase | NormalizedMetalPurchase;

export type NormalizedCashSale = NormalizedCashPurchase & { aedAmount: number };
export type NormalizedMetalSale = NormalizedMetalPurchase & { aedAmount: number };
export type NormalizedSale = NormalizedCashSale | NormalizedMetalSale;

function roundQty(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(IC_QUANTITY_DECIMAL_PLACES));
}

function roundRate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(IC_RATE_DECIMAL_PLACES));
}

function roundWeight(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(METAL_WEIGHT_DECIMALS));
}

function assertAedAgentForSplitPayment(
  paymentMethod: MetalPaymentMethod,
  aedAgentId?: string | null,
): void {
  if (paymentMethod !== 'SPLIT') return;
  if (!String(aedAgentId ?? '').trim()) {
    throw new Error('Select a collection agent for the AED leg of a split payment.');
  }
}

export function isICSettlementMode(value: string): value is ICSettlementMode {
  return (IC_SETTLEMENT_MODES as readonly string[]).includes(value);
}

export function deriveUnitsFromInrTotal(inrTotal: number): number {
  const inr = Number(inrTotal);
  if (!Number.isFinite(inr) || inr <= 0) {
    throw new Error('INR total must be greater than zero.');
  }
  return roundQty(inr / INR_PER_UNIT);
}

/** IC units implied by an INR total; 0 when INR is missing. */
export function icUnitsFromInrTotal(inrTotal: number): number {
  const inr = Number(inrTotal);
  if (!Number.isFinite(inr) || inr <= 0) return 0;
  return roundQty(inr / INR_PER_UNIT);
}

export function aedTotalFromIcUnitRate(inrTotal: number, unitRateAed: number): number {
  const u = icUnitsFromInrTotal(inrTotal);
  return roundMoney(computeIcCashAedTotal(u, Number(unitRateAed) || 0));
}

export function icUnitRateFromAedTotal(inrTotal: number, aedTotal: number): number {
  const units = icUnitsFromInrTotal(inrTotal);
  if (units <= 0) return 0;
  return roundRate(computeIcCashRateFromTotals(units, Number(aedTotal) || 0));
}

/** Imputed sheet RATE from cash IC AED and units (AED ÷ units ÷ 100). */
export function deriveImputedUnitRateAed(aedTotal: number, units: number): number {
  const aed = Number(aedTotal);
  const u = Number(units);
  if (!Number.isFinite(aed) || aed <= 0) {
    throw new Error('AED total must be greater than zero.');
  }
  if (!Number.isFinite(u) || u <= 0) {
    throw new Error('Units must be greater than zero.');
  }
  return roundRate(computeIcCashRateFromTotals(u, aed));
}

export function computeMetalAedFromInr(inrTotal: number, sheetRateAed: number): number {
  return roundMoney((roundMoney(inrTotal) * roundRate(sheetRateAed)) / METAL_AED_RATE_DIVISOR);
}

/**
 * Metal · AED agent rows store **gross** AED (from gross INR × sheet rate).
 * Ledgers net with the same INR/AED proportion when lab applies.
 */
export function grossMetalAedFromNetBooked(
  netAedBooked: number,
  grossInr: number,
  labTotalInr: number,
): number {
  const gross = roundMoney(grossInr);
  const netInr = netMetalInr(gross, labTotalInr);
  const netAed = roundMoney(netAedBooked);
  if (netInr <= 0 || netAed <= 0) return netAed;
  if (netInr >= gross - 0.0001) return netAed;
  return roundMoney((netAed * gross) / netInr);
}

export function netMetalAedFromGrossBooked(
  storedGrossAed: number,
  grossInr: number,
  labTotalInr: number,
): number {
  const gross = roundMoney(grossInr);
  const aed = roundMoney(storedGrossAed);
  if (aed <= 0 || gross <= 0) return aed;
  const netInr = netMetalInr(gross, labTotalInr);
  if (netInr >= gross - 0.0001) return aed;
  return roundMoney((aed * netInr) / gross);
}

/** Implied sheet RATE from INR and AED (AED × 1000 ÷ INR). */
export function computeMetalSheetRateAed(inrTotal: number, aedTotal: number): number {
  const inr = roundMoney(inrTotal);
  if (inr <= 0) return 0;
  return roundRate((roundMoney(aedTotal) * METAL_AED_RATE_DIVISOR) / inr);
}

/**
 * Cash IC RATE and metal sheet RATE are the same ~36 field (AED per IC unit vs INR×rate÷1000).
 * Prefill metal from warehouse WAC 1:1.
 */
export function metalSheetRateFromIcUnitRate(icUnitRateAed: number): number {
  const u = Number(icUnitRateAed);
  if (!Number.isFinite(u) || u <= 0) return 0;
  return roundRate(u);
}

export function computeImpliedMetalRateAedPerG(weightG: number, aedTotal: number): number {
  const w = roundWeight(weightG);
  if (w <= 0) return 0;
  return roundRate(roundMoney(aedTotal) / w);
}

export function computeMetalTotalsFromWeight(
  weightG: number,
  rateInrPerG: number,
  sheetRateAed: number,
): { totalInr: number; totalAed: number } {
  const w = roundWeight(weightG);
  if (w <= 0) throw new Error('Weight must be greater than zero.');
  const totalInr = roundMoney(w * rateInrPerG);
  return {
    totalInr,
    totalAed: computeMetalAedFromInr(totalInr, sheetRateAed),
  };
}

export function metalFieldsFromRecord(input: {
  metalWeightG?: number | null;
  metalRateInrPerG?: number | null;
  metalRateAedPerG?: number | null;
  inrTotal?: number | null;
  aedTotal?: number | null;
  unitRate?: number | null;
  labTotalInr?: number | null;
}): MetalSettlementFields {
  const metalWeightG = Number(input.metalWeightG) || 0;
  const metalRateInrPerG = Number(input.metalRateInrPerG) || 0;
  const inrTotal = Number(input.inrTotal) || 0;
  const storedAed = Number(input.aedTotal) || 0;
  const storedSheetRate = roundRate(Number(input.unitRate) || 0);
  const labTotal = roundMoney(Number(input.labTotalInr) || 0);
  const netInr = netMetalInr(inrTotal, labTotal);
  const netAedBooked = netMetalAedFromGrossBooked(storedAed, inrTotal, labTotal);
  const isGrossStored = labTotal > 0 && Math.abs(netAedBooked - storedAed) > 0.01;

  const metalSheetRateAed =
    storedSheetRate > 0
      ? storedSheetRate
      : labTotal > 0 && netInr > 0
        ? computeMetalSheetRateAed(netInr, isGrossStored ? netAedBooked : storedAed)
        : computeMetalSheetRateAed(inrTotal, storedAed);

  let aedTotal = storedAed;
  if (storedAed > 0 && labTotal > 0) {
    aedTotal =
      storedSheetRate > 0
        ? computeMetalAedFromInr(netInr, storedSheetRate)
        : isGrossStored
          ? netAedBooked
          : storedAed;
  }

  const metalRateAedPerG =
    metalWeightG > 0 && aedTotal > 0
      ? computeImpliedMetalRateAedPerG(metalWeightG, aedTotal)
      : Number(input.metalRateAedPerG) || 0;
  return {
    metalWeightG,
    metalRateInrPerG,
    metalSheetRateAed,
    metalRateAedPerG,
    inrTotal,
    aedTotal,
  };
}

/** Metal sale form: same sheet RATE as purchases (AED = INR × rate ÷ 1000). */
export function metalSaleFieldsFromRecord(
  input: Parameters<typeof metalFieldsFromRecord>[0] & { unitRate?: number | null },
): MetalSettlementFields {
  const base = metalFieldsFromRecord(input);
  return {
    ...base,
    /** Omit aedRateMode — purchases and sales both use sheet formula in applyMetalFieldChange. */
    aedTotal: base.aedTotal > 0 ? base.aedTotal : computeMetalAedFromInr(base.inrTotal, base.metalSheetRateAed),
  };
}

function withDerivedAedPerG(fields: MetalSettlementFields): MetalSettlementFields {
  return {
    ...fields,
    metalRateAedPerG: computeImpliedMetalRateAedPerG(fields.metalWeightG, fields.aedTotal),
  };
}

export function applyMetalFieldChange(
  value: MetalSettlementFields,
  field: 'weight' | 'rateInr' | 'sheetRateAed' | 'totalInr' | 'totalAed',
  num: number,
): MetalSettlementFields {
  const unitMode = value.aedRateMode === 'unit';
  switch (field) {
    case 'weight': {
      if (num <= 0) {
        return { ...value, metalWeightG: num };
      }
      const totalInr = roundMoney(num * value.metalRateInrPerG);
      const totalAed = unitMode
        ? aedTotalFromIcUnitRate(totalInr, value.metalSheetRateAed)
        : computeMetalAedFromInr(totalInr, value.metalSheetRateAed);
      return withDerivedAedPerG({
        ...value,
        metalWeightG: num,
        inrTotal: totalInr,
        aedTotal: totalAed,
      });
    }
    case 'rateInr': {
      const w = value.metalWeightG;
      if (w <= 0) return { ...value, metalRateInrPerG: num };
      const totalInr = roundMoney(w * num);
      const totalAed = unitMode
        ? aedTotalFromIcUnitRate(totalInr, value.metalSheetRateAed)
        : computeMetalAedFromInr(totalInr, value.metalSheetRateAed);
      return withDerivedAedPerG({
        ...value,
        metalRateInrPerG: num,
        inrTotal: totalInr,
        aedTotal: totalAed,
      });
    }
    case 'sheetRateAed': {
      const aedTotal = unitMode
        ? aedTotalFromIcUnitRate(value.inrTotal, num)
        : computeMetalAedFromInr(value.inrTotal, num);
      return withDerivedAedPerG({
        ...value,
        metalSheetRateAed: num,
        aedTotal,
      });
    }
    case 'totalInr': {
      const w = value.metalWeightG;
      const metalRateInrPerG = w > 0 ? computeMetalRateInrFromTotal(w, num) : value.metalRateInrPerG;
      const aedTotal = unitMode
        ? aedTotalFromIcUnitRate(num, value.metalSheetRateAed)
        : computeMetalAedFromInr(num, value.metalSheetRateAed);
      return withDerivedAedPerG({
        ...value,
        inrTotal: num,
        metalRateInrPerG,
        aedTotal,
      });
    }
    case 'totalAed': {
      const metalSheetRateAed = unitMode
        ? icUnitRateFromAedTotal(value.inrTotal, num)
        : computeMetalSheetRateAed(value.inrTotal, num);
      return withDerivedAedPerG({
        ...value,
        aedTotal: num,
        metalSheetRateAed,
      });
    }
    default:
      return value;
  }
}

export function computeMetalRateInrFromTotal(weightG: number, totalInr: number): number {
  const w = roundWeight(weightG);
  if (w <= 0) throw new Error('Weight must be greater than zero.');
  const total = roundMoney(totalInr);
  if (total <= 0) throw new Error('INR total must be greater than zero.');
  return roundRate(total / w);
}

export function computeMetalRateAedFromTotal(weightG: number, totalAed: number): number {
  const w = roundWeight(weightG);
  if (w <= 0) throw new Error('Weight must be greater than zero.');
  const total = roundMoney(totalAed);
  if (total <= 0) throw new Error('AED total must be greater than zero.');
  return roundRate(total / w);
}

export function validateMetalSettlementInput(
  input: MetalSettlementInput,
  paymentMethod: MetalPaymentMethod = 'AED',
): void {
  const w = roundWeight(input.metalWeightG);
  if (w <= 0) throw new Error('Weight (g) is required.');
  if (roundMoney(input.totalInr) <= 0) throw new Error('Total INR must be greater than zero.');
  if (roundRate(input.metalRateInrPerG) <= 0) throw new Error('Rate per gram (INR) must be greater than zero.');
  if (paymentMethod === 'AED' || paymentMethod === 'SPLIT') {
    if (roundMoney(input.totalAed) <= 0) throw new Error('Total AED must be greater than zero.');
    if (roundRate(input.metalRateAedPerG) <= 0) {
      throw new Error('Rate per gram (AED) must be greater than zero.');
    }
  }
}

export function validateMetalSaleSettlementInput(input: MetalSettlementInput): void {
  const w = roundWeight(input.metalWeightG);
  if (w <= 0) throw new Error('Weight (g) is required.');
  if (roundMoney(input.totalInr) <= 0) throw new Error('Total INR must be greater than zero.');
  if (roundRate(input.metalRateInrPerG) <= 0) throw new Error('Rate per gram (INR) must be greater than zero.');
  if (roundMoney(input.totalAed) <= 0) throw new Error('Total AED must be greater than zero.');
  const labTotal = roundMoney(input.labTotalInr ?? 0);
  const netInr = netMetalInr(roundMoney(input.totalInr), labTotal);
  const units = icUnitsFromInrTotal(netInr);
  if (units <= 0) throw new Error('INR total (after lab) must convert to IC units (₹1 lakh = 1 unit).');
  if (computeMetalSheetRateAed(netInr, input.totalAed) <= 0) {
    throw new Error('AED sheet rate must be greater than zero.');
  }
}

export function normalizeMetalPurchase(
  input: MetalSettlementInput,
  options?: {
    paymentMethod?: MetalPaymentMethod;
    aedAgentId?: string | null;
    unitRate?: number | null;
    splitInrPaid?: number | null;
    splitAedPaid?: number | null;
  },
): NormalizedMetalPurchase {
  const paymentMethod = normalizeMetalPaymentMethod(options?.paymentMethod);
  assertAedAgentForSplitPayment(paymentMethod, options?.aedAgentId);
  validateMetalSettlementInput(input, paymentMethod);
  const inrTotal = roundMoney(input.totalInr);
  const labTotal = roundMoney(input.labTotalInr ?? 0);
  const netInr = netMetalInr(inrTotal, labTotal);
  const aedTotal = needsMetalAedAgent(paymentMethod) ? roundMoney(input.totalAed) : null;
  let split: MetalSplitAmounts | null = null;
  if (paymentMethod === 'SPLIT') {
    split = finalizeSplitAmounts(inrTotal, roundMoney(input.totalAed), options?.splitInrPaid, options?.splitAedPaid);
    assertSplitAmounts(inrTotal, roundMoney(input.totalAed), split);
  }
  const explicitRate = roundRate(Number(options?.unitRate) || 0);
  const unitRate =
    needsMetalAedAgent(paymentMethod) && aedTotal != null && aedTotal > 0
      ? explicitRate > 0
        ? explicitRate
        : computeMetalSheetRateAed(
            labTotal > 0 ? netInr : inrTotal,
            labTotal > 0 ? netMetalAedFromGrossBooked(aedTotal, inrTotal, labTotal) : aedTotal,
          )
      : 0;
  return {
    settlementMode: 'metal',
    units: 0,
    unitRate,
    aedTotal,
    inrTotal,
    metalWeightG: roundWeight(input.metalWeightG),
    metalRateInrPerG: roundRate(input.metalRateInrPerG),
    metalRateAedPerG: needsMetalAedAgent(paymentMethod) ? roundRate(input.metalRateAedPerG) : 0,
    metalPaymentMethod: paymentMethod,
    aedAgentId: needsMetalAedAgent(paymentMethod) ? options?.aedAgentId ?? null : null,
    splitInrPaid: split?.paidInr ?? null,
    splitAedPaid: split?.paidAed ?? null,
  };
}

export function normalizeCashPurchase(params: {
  units: number;
  unitRate: number;
  aedTotal?: number | null;
}): NormalizedCashPurchase {
  const units = roundQty(params.units);
  const unitRate = roundRate(params.unitRate);
  if (units <= 0) throw new Error('Units must be greater than zero.');
  if (unitRate <= 0) throw new Error('Unit rate must be greater than zero.');
  const aedTotal =
    params.aedTotal != null && Number.isFinite(Number(params.aedTotal))
      ? roundMoney(Number(params.aedTotal))
      : roundMoney(computeIcCashAedTotal(units, unitRate));
  if (aedTotal <= 0) throw new Error('AED total must be greater than zero.');
  return {
    settlementMode: 'cash',
    units,
    unitRate,
    aedTotal,
    inrTotal: null,
    metalWeightG: null,
    metalRateInrPerG: null,
    metalRateAedPerG: null,
  };
}

export function normalizeMetalSale(
  input: MetalSettlementInput,
  serviceCharge: number = 0,
  options?: {
    paymentMethod?: MetalPaymentMethod;
    aedAgentId?: string | null;
    unitRate?: number | null;
    splitInrPaid?: number | null;
    splitAedPaid?: number | null;
  },
): NormalizedMetalSale {
  const paymentMethod = normalizeMetalPaymentMethod(options?.paymentMethod ?? 'AED');
  assertAedAgentForSplitPayment(paymentMethod, options?.aedAgentId);
  validateMetalSaleSettlementInput(input);
  const inrTotal = roundMoney(input.totalInr);
  const labTotal = roundMoney(input.labTotalInr ?? 0);
  const netInr = netMetalInr(inrTotal, labTotal);
  const units = deriveUnitsFromInrTotal(netInr);
  const aedTotal = roundMoney(input.totalAed);
  const netAed = netMetalAedFromGrossBooked(aedTotal, inrTotal, labTotal);
  let split: MetalSplitAmounts | null = null;
  if (paymentMethod === 'SPLIT') {
    split = finalizeSplitAmounts(inrTotal, aedTotal, options?.splitInrPaid, options?.splitAedPaid);
    assertSplitAmounts(inrTotal, aedTotal, split);
  }
  const explicitRate = roundRate(Number(options?.unitRate) || 0);
  /** Stored RATE is the metal sheet field (AED × 1000 ÷ net INR), same ~36 range as cash IC. */
  const unitRate =
    explicitRate > 0 ? explicitRate : computeMetalSheetRateAed(netInr, netAed);
  const charge = roundMoney(Math.max(0, serviceCharge));
  const aedAmount = roundMoney(Math.max(0, aedTotal - charge));
  const splitUnits =
    paymentMethod === 'SPLIT' && split
      ? deriveUnitsFromInrTotal(netMetalInr(split.paidInr, 0))
      : 0;
  return {
    settlementMode: 'metal',
    units: paymentMethod === 'CASH' ? units : splitUnits,
    unitRate,
    aedTotal,
    inrTotal,
    metalWeightG: roundWeight(input.metalWeightG),
    metalRateInrPerG: roundRate(input.metalRateInrPerG),
    metalRateAedPerG: computeImpliedMetalRateAedPerG(input.metalWeightG, aedTotal),
    metalPaymentMethod: paymentMethod,
    aedAgentId: needsMetalAedAgent(paymentMethod) ? options?.aedAgentId ?? null : null,
    aedAmount,
    splitInrPaid: split?.paidInr ?? null,
    splitAedPaid: split?.paidAed ?? null,
  };
}

export function normalizeCashSale(params: {
  units: number;
  unitRate: number;
  aedAmount?: number | null;
  serviceCharge?: number;
}): NormalizedCashSale {
  const charge = roundMoney(Math.max(0, params.serviceCharge ?? 0));
  const cash = normalizeCashPurchase({
    units: params.units,
    unitRate: params.unitRate,
    aedTotal:
      params.aedAmount != null
        ? Number(params.aedAmount) + charge
        : undefined,
  });
  const aedAmount =
    params.aedAmount != null && Number.isFinite(Number(params.aedAmount))
      ? roundMoney(Number(params.aedAmount))
      : roundMoney(Math.max(0, cash.aedTotal - charge));
  return {
    ...cash,
    aedAmount,
  };
}

export function formatSettlementModeLabel(
  mode?: ICSettlementMode | string | null,
  paymentMethod?: string | null,
): string {
  if (mode === 'metal') {
    if (isMetalSplitPayment(paymentMethod)) return 'Metal · Split';
    return isMetalAedPayment(paymentMethod) ? 'Metal · AED' : 'Metal · INR';
  }
  return 'Cash';
}

export function resolvePurchaseInrDisplay(purchase: {
  settlementMode?: ICSettlementMode | string | null;
  inrTotal?: number | null;
  units: number;
  labTotalInr?: number | null;
}): number {
  if (purchase.settlementMode === 'metal' && purchase.inrTotal != null) {
    return netMetalInr(Number(purchase.inrTotal), Number(purchase.labTotalInr) || 0);
  }
  return roundMoney(Number(purchase.units) * INR_PER_UNIT);
}

export function resolveSaleInrDisplay(sale: {
  settlementMode?: ICSettlementMode | string | null;
  inrTotal?: number | null;
  units: number;
  labTotalInr?: number | null;
}): number {
  return resolvePurchaseInrDisplay(sale);
}

export type PurchaseFormInput = {
  settlementMode?: ICSettlementMode | string | null;
  units?: number;
  unitRate?: number;
  aedTotal?: number | null;
  metalWeightG?: number;
  metalRateInrPerG?: number;
  metalRateAedPerG?: number;
  inrTotal?: number;
  labTotalInr?: number | null;
  metalPaymentMethod?: MetalPaymentMethod | 'INR' | 'AED' | string | null;
  aedAgentId?: string | null;
  splitInrPaid?: number | null;
  splitAedPaid?: number | null;
};

export type SaleFormInput = PurchaseFormInput & {
  aedAmount?: number | null;
  serviceCharge?: number;
  metalPurchaseId?: string | null;
};

export function assertSettlementModeUnchanged(
  existing: ICSettlementMode | string | null | undefined,
  next: ICSettlementMode | string | null | undefined,
): void {
  const prev = existing === 'metal' ? 'metal' : 'cash';
  const mode = next === 'metal' ? 'metal' : 'cash';
  if (prev !== mode) {
    throw new Error('Settlement mode cannot be changed when editing.');
  }
}

export function resolveNormalizedPurchase(
  input: PurchaseFormInput,
  existingMode?: ICSettlementMode | string | null,
): NormalizedPurchase {
  if (existingMode != null && input.settlementMode != null) {
    assertSettlementModeUnchanged(existingMode, input.settlementMode);
  }
  const mode =
    input.settlementMode === 'metal' || existingMode === 'metal'
      ? 'metal'
      : 'cash';
  if (mode === 'metal') {
    const paymentMethod = normalizeMetalPaymentMethod(input.metalPaymentMethod);
    return normalizeMetalPurchase(
      {
        metalWeightG: Number(input.metalWeightG),
        metalRateInrPerG: Number(input.metalRateInrPerG),
        metalRateAedPerG: Number(input.metalRateAedPerG),
        totalInr: Number(input.inrTotal),
        totalAed: Number(input.aedTotal ?? 0),
        labTotalInr: Number(input.labTotalInr ?? 0),
      },
      {
        paymentMethod,
        aedAgentId: input.aedAgentId,
        unitRate: input.unitRate,
        splitInrPaid: input.splitInrPaid,
        splitAedPaid: input.splitAedPaid,
      },
    );
  }
  return normalizeCashPurchase({
    units: Number(input.units),
    unitRate: Number(input.unitRate),
    aedTotal: input.aedTotal,
  });
}

export function resolveNormalizedSale(
  input: SaleFormInput,
  existingMode?: ICSettlementMode | string | null,
): NormalizedSale {
  if (existingMode != null && input.settlementMode != null) {
    assertSettlementModeUnchanged(existingMode, input.settlementMode);
  }
  const mode =
    input.settlementMode === 'metal' || existingMode === 'metal'
      ? 'metal'
      : 'cash';
  if (mode === 'metal') {
    const paymentMethod = normalizeMetalPaymentMethod(input.metalPaymentMethod ?? 'AED');
    return normalizeMetalSale(
      {
        metalWeightG: Number(input.metalWeightG),
        metalRateInrPerG: Number(input.metalRateInrPerG),
        metalRateAedPerG: Number(input.metalRateAedPerG),
        totalInr: Number(input.inrTotal),
        totalAed: Number(input.aedAmount ?? input.aedTotal),
        labTotalInr: Number(input.labTotalInr ?? 0),
      },
      input.serviceCharge ?? 0,
      {
        paymentMethod,
        aedAgentId: input.aedAgentId,
        unitRate: input.unitRate,
        splitInrPaid: input.splitInrPaid,
        splitAedPaid: input.splitAedPaid,
      },
    );
  }
  return normalizeCashSale({
    units: Number(input.units),
    unitRate: Number(input.unitRate),
    aedAmount: input.aedAmount,
    serviceCharge: input.serviceCharge,
  });
}
