import { INR_PER_UNIT } from './rateCalculations';
import { netMetalInr } from '@/lib/icTransfer/labTest';
import { isMetalAedPayment, normalizeMetalPaymentMethod, type MetalPaymentMethod } from '@/lib/domain/books';

export const IC_SETTLEMENT_MODES = ['cash', 'metal'] as const;
export type ICSettlementMode = (typeof IC_SETTLEMENT_MODES)[number];

export const METAL_WEIGHT_DECIMALS = 4;
export const METAL_AMOUNT_DECIMALS = 4;

/**
 * Metal sheet RATE column: AED = INR × RATE / 1,000.
 * This is not AED per gram and not IC units (1 unit = 1 lakh).
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
  /** Sheet RATE (purchases) or IC unit rate (sales) depending on aedRateMode. */
  metalSheetRateAed: number;
  /** Implied AED per gram, stored on the row. */
  metalRateAedPerG: number;
  inrTotal: number;
  aedTotal: number;
  /** Sales: AED rate is per IC unit (1 unit = ₹1 lakh). Purchases keep sheet RATE. */
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
  metalPaymentMethod: 'CASH' | 'AED';
  aedAgentId?: string | null;
};

export type NormalizedPurchase = NormalizedCashPurchase | NormalizedMetalPurchase;

export type NormalizedCashSale = NormalizedCashPurchase & { aedAmount: number };
export type NormalizedMetalSale = NormalizedMetalPurchase & { aedAmount: number };
export type NormalizedSale = NormalizedCashSale | NormalizedMetalSale;

function round4(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(METAL_AMOUNT_DECIMALS));
}

function roundWeight(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(METAL_WEIGHT_DECIMALS));
}

export function isICSettlementMode(value: string): value is ICSettlementMode {
  return (IC_SETTLEMENT_MODES as readonly string[]).includes(value);
}

export function deriveUnitsFromInrTotal(inrTotal: number): number {
  const inr = Number(inrTotal);
  if (!Number.isFinite(inr) || inr <= 0) {
    throw new Error('INR total must be greater than zero.');
  }
  return round4(inr / INR_PER_UNIT);
}

/** IC units implied by an INR total; 0 when INR is missing. */
export function icUnitsFromInrTotal(inrTotal: number): number {
  const inr = Number(inrTotal);
  if (!Number.isFinite(inr) || inr <= 0) return 0;
  return round4(inr / INR_PER_UNIT);
}

export function aedTotalFromIcUnitRate(inrTotal: number, unitRateAed: number): number {
  return round4(icUnitsFromInrTotal(inrTotal) * (Number(unitRateAed) || 0));
}

export function icUnitRateFromAedTotal(inrTotal: number, aedTotal: number): number {
  const units = icUnitsFromInrTotal(inrTotal);
  if (units <= 0) return 0;
  return round4((Number(aedTotal) || 0) / units);
}

export function deriveImputedUnitRateAed(aedTotal: number, units: number): number {
  const aed = Number(aedTotal);
  const u = Number(units);
  if (!Number.isFinite(aed) || aed <= 0) {
    throw new Error('AED total must be greater than zero.');
  }
  if (!Number.isFinite(u) || u <= 0) {
    throw new Error('Units must be greater than zero.');
  }
  return round4(aed / u);
}

export function computeMetalAedFromInr(inrTotal: number, sheetRateAed: number): number {
  return round4((round4(inrTotal) * round4(sheetRateAed)) / METAL_AED_RATE_DIVISOR);
}

export function computeMetalSheetRateAed(inrTotal: number, aedTotal: number): number {
  const inr = round4(inrTotal);
  if (inr <= 0) return 0;
  return round4((round4(aedTotal) * METAL_AED_RATE_DIVISOR) / inr);
}

export function computeImpliedMetalRateAedPerG(weightG: number, aedTotal: number): number {
  const w = roundWeight(weightG);
  if (w <= 0) return 0;
  return round4(round4(aedTotal) / w);
}

export function computeMetalTotalsFromWeight(
  weightG: number,
  rateInrPerG: number,
  sheetRateAed: number,
): { totalInr: number; totalAed: number } {
  const w = roundWeight(weightG);
  if (w <= 0) throw new Error('Weight must be greater than zero.');
  const totalInr = round4(w * rateInrPerG);
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
}): MetalSettlementFields {
  const metalWeightG = Number(input.metalWeightG) || 0;
  const metalRateInrPerG = Number(input.metalRateInrPerG) || 0;
  const inrTotal = Number(input.inrTotal) || 0;
  const aedTotal = Number(input.aedTotal) || 0;
  const metalSheetRateAed = computeMetalSheetRateAed(inrTotal, aedTotal);
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

/** Metal sale form: AED rate is IC unit rate, not the sheet RATE column. */
export function metalSaleFieldsFromRecord(
  input: Parameters<typeof metalFieldsFromRecord>[0] & { unitRate?: number | null },
): MetalSettlementFields {
  const base = metalFieldsFromRecord(input);
  const unitRate =
    Number(input.unitRate) > 0
      ? round4(Number(input.unitRate))
      : icUnitRateFromAedTotal(base.inrTotal, base.aedTotal);
  return {
    ...base,
    aedRateMode: 'unit',
    metalSheetRateAed: unitRate,
    aedTotal:
      base.aedTotal > 0 ? base.aedTotal : aedTotalFromIcUnitRate(base.inrTotal, unitRate),
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
      const totalInr = round4(num * value.metalRateInrPerG);
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
      const totalInr = round4(w * num);
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
  const total = round4(totalInr);
  if (total <= 0) throw new Error('INR total must be greater than zero.');
  return round4(total / w);
}

export function computeMetalRateAedFromTotal(weightG: number, totalAed: number): number {
  const w = roundWeight(weightG);
  if (w <= 0) throw new Error('Weight must be greater than zero.');
  const total = round4(totalAed);
  if (total <= 0) throw new Error('AED total must be greater than zero.');
  return round4(total / w);
}

export function validateMetalSettlementInput(
  input: MetalSettlementInput,
  paymentMethod: MetalPaymentMethod = 'AED',
): void {
  const w = roundWeight(input.metalWeightG);
  if (w <= 0) throw new Error('Weight (g) is required.');
  if (round4(input.totalInr) <= 0) throw new Error('Total INR must be greater than zero.');
  if (round4(input.metalRateInrPerG) <= 0) throw new Error('Rate per gram (INR) must be greater than zero.');
  if (paymentMethod === 'AED') {
    if (round4(input.totalAed) <= 0) throw new Error('Total AED must be greater than zero.');
    if (round4(input.metalRateAedPerG) <= 0) {
      throw new Error('Rate per gram (AED) must be greater than zero.');
    }
  }
}

export function validateMetalSaleSettlementInput(input: MetalSettlementInput): void {
  const w = roundWeight(input.metalWeightG);
  if (w <= 0) throw new Error('Weight (g) is required.');
  if (round4(input.totalInr) <= 0) throw new Error('Total INR must be greater than zero.');
  if (round4(input.metalRateInrPerG) <= 0) throw new Error('Rate per gram (INR) must be greater than zero.');
  if (round4(input.totalAed) <= 0) throw new Error('Total AED must be greater than zero.');
  const units = icUnitsFromInrTotal(input.totalInr);
  if (units <= 0) throw new Error('INR total must convert to IC units (₹1 lakh = 1 unit).');
  if (icUnitRateFromAedTotal(input.totalInr, input.totalAed) <= 0) {
    throw new Error('AED unit rate must be greater than zero.');
  }
}

export function normalizeMetalPurchase(
  input: MetalSettlementInput,
  options?: { paymentMethod?: MetalPaymentMethod; aedAgentId?: string | null },
): NormalizedMetalPurchase {
  const paymentMethod = normalizeMetalPaymentMethod(options?.paymentMethod);
  validateMetalSettlementInput(input, paymentMethod);
  const inrTotal = round4(input.totalInr);
  const aedTotal = paymentMethod === 'AED' ? round4(input.totalAed) : null;
  return {
    settlementMode: 'metal',
    units: 0,
    unitRate: 0,
    aedTotal,
    inrTotal,
    metalWeightG: roundWeight(input.metalWeightG),
    metalRateInrPerG: round4(input.metalRateInrPerG),
    metalRateAedPerG: paymentMethod === 'AED' ? round4(input.metalRateAedPerG) : 0,
    metalPaymentMethod: paymentMethod,
    aedAgentId: paymentMethod === 'AED' ? options?.aedAgentId ?? null : null,
  };
}

export function normalizeCashPurchase(params: {
  units: number;
  unitRate: number;
  aedTotal?: number | null;
}): NormalizedCashPurchase {
  const units = round4(params.units);
  const unitRate = round4(params.unitRate);
  if (units <= 0) throw new Error('Units must be greater than zero.');
  if (unitRate <= 0) throw new Error('Unit rate must be greater than zero.');
  const aedTotal =
    params.aedTotal != null && Number.isFinite(Number(params.aedTotal))
      ? round4(Number(params.aedTotal))
      : round4(units * unitRate);
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
  options?: { paymentMethod?: MetalPaymentMethod; aedAgentId?: string | null },
): NormalizedMetalSale {
  const paymentMethod = normalizeMetalPaymentMethod(options?.paymentMethod ?? 'AED');
  validateMetalSaleSettlementInput(input);
  const inrTotal = round4(input.totalInr);
  const labTotal = round4(input.labTotalInr ?? 0);
  const netInr = netMetalInr(inrTotal, labTotal);
  const units = deriveUnitsFromInrTotal(netInr);
  const aedTotal = round4(input.totalAed);
  const unitRate = icUnitRateFromAedTotal(inrTotal, aedTotal);
  const charge = round4(Math.max(0, serviceCharge));
  const aedAmount = round4(Math.max(0, aedTotal - charge));
  return {
    settlementMode: 'metal',
    units: paymentMethod === 'CASH' ? units : 0,
    unitRate,
    aedTotal,
    inrTotal,
    metalWeightG: roundWeight(input.metalWeightG),
    metalRateInrPerG: round4(input.metalRateInrPerG),
    metalRateAedPerG: computeImpliedMetalRateAedPerG(input.metalWeightG, aedTotal),
    metalPaymentMethod: paymentMethod,
    aedAgentId: paymentMethod === 'AED' ? options?.aedAgentId ?? null : null,
    aedAmount,
  };
}

export function normalizeCashSale(params: {
  units: number;
  unitRate: number;
  aedAmount?: number | null;
  serviceCharge?: number;
}): NormalizedCashSale {
  const charge = round4(Math.max(0, params.serviceCharge ?? 0));
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
      ? round4(Number(params.aedAmount))
      : round4(Math.max(0, cash.aedTotal - charge));
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
  return round4(Number(purchase.units) * INR_PER_UNIT);
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
  metalPaymentMethod?: MetalPaymentMethod | 'INR' | 'AED' | string | null;
  aedAgentId?: string | null;
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
      },
      { paymentMethod, aedAgentId: input.aedAgentId },
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
      },
      input.serviceCharge ?? 0,
      { paymentMethod, aedAgentId: input.aedAgentId },
    );
  }
  return normalizeCashSale({
    units: Number(input.units),
    unitRate: Number(input.unitRate),
    aedAmount: input.aedAmount,
    serviceCharge: input.serviceCharge,
  });
}
