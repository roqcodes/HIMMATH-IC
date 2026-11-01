import { INR_PER_UNIT } from './rateCalculations';

export const IC_SETTLEMENT_MODES = ['cash', 'metal'] as const;
export type ICSettlementMode = (typeof IC_SETTLEMENT_MODES)[number];

export const METAL_WEIGHT_DECIMALS = 4;
export const METAL_AMOUNT_DECIMALS = 4;

export type MetalSettlementInput = {
  metalWeightG: number;
  metalRateInrPerG: number;
  metalRateAedPerG: number;
  totalInr: number;
  totalAed: number;
};

export type MetalSettlementFields = {
  metalWeightG: number;
  metalRateInrPerG: number;
  metalRateAedPerG: number;
  inrTotal: number;
  aedTotal: number;
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
  aedTotal: number;
  inrTotal: number;
  metalWeightG: number;
  metalRateInrPerG: number;
  metalRateAedPerG: number;
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

export function computeMetalTotalsFromWeight(
  weightG: number,
  rateInrPerG: number,
  rateAedPerG: number,
): { totalInr: number; totalAed: number } {
  const w = roundWeight(weightG);
  if (w <= 0) throw new Error('Weight must be greater than zero.');
  return {
    totalInr: round4(w * rateInrPerG),
    totalAed: round4(w * rateAedPerG),
  };
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

export function validateMetalSettlementInput(input: MetalSettlementInput): void {
  const w = roundWeight(input.metalWeightG);
  if (w <= 0) throw new Error('Weight (g) is required.');
  if (round4(input.totalInr) <= 0) throw new Error('Total INR must be greater than zero.');
  if (round4(input.totalAed) <= 0) throw new Error('Total AED must be greater than zero.');
  if (round4(input.metalRateInrPerG) <= 0) throw new Error('Rate per gram (INR) must be greater than zero.');
  if (round4(input.metalRateAedPerG) <= 0) throw new Error('Rate per gram (AED) must be greater than zero.');
}

export function normalizeMetalPurchase(input: MetalSettlementInput): NormalizedMetalPurchase {
  validateMetalSettlementInput(input);
  const inrTotal = round4(input.totalInr);
  const aedTotal = round4(input.totalAed);
  return {
    settlementMode: 'metal',
    units: 0,
    unitRate: 0,
    aedTotal,
    inrTotal,
    metalWeightG: roundWeight(input.metalWeightG),
    metalRateInrPerG: round4(input.metalRateInrPerG),
    metalRateAedPerG: round4(input.metalRateAedPerG),
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
): NormalizedMetalSale {
  const base = normalizeMetalPurchase(input);
  const charge = round4(Math.max(0, serviceCharge));
  const aedAmount = round4(Math.max(0, base.aedTotal - charge));
  return {
    ...base,
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

export function formatSettlementModeLabel(mode?: ICSettlementMode | string | null): string {
  if (mode === 'metal') return 'Metal';
  return 'Cash';
}

export function resolvePurchaseInrDisplay(purchase: {
  settlementMode?: ICSettlementMode | string | null;
  inrTotal?: number | null;
  units: number;
}): number {
  if (purchase.settlementMode === 'metal' && purchase.inrTotal != null) {
    return Number(purchase.inrTotal);
  }
  return round4(Number(purchase.units) * INR_PER_UNIT);
}

export function resolveSaleInrDisplay(sale: {
  settlementMode?: ICSettlementMode | string | null;
  inrTotal?: number | null;
  units: number;
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
};

export type SaleFormInput = PurchaseFormInput & {
  aedAmount?: number | null;
  serviceCharge?: number;
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
    return normalizeMetalPurchase({
      metalWeightG: Number(input.metalWeightG),
      metalRateInrPerG: Number(input.metalRateInrPerG),
      metalRateAedPerG: Number(input.metalRateAedPerG),
      totalInr: Number(input.inrTotal),
      totalAed: Number(input.aedTotal),
    });
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
    return normalizeMetalSale(
      {
        metalWeightG: Number(input.metalWeightG),
        metalRateInrPerG: Number(input.metalRateInrPerG),
        metalRateAedPerG: Number(input.metalRateAedPerG),
        totalInr: Number(input.inrTotal),
        totalAed: Number(input.aedAmount ?? input.aedTotal),
      },
      input.serviceCharge ?? 0,
    );
  }
  return normalizeCashSale({
    units: Number(input.units),
    unitRate: Number(input.unitRate),
    aedAmount: input.aedAmount,
    serviceCharge: input.serviceCharge,
  });
}
