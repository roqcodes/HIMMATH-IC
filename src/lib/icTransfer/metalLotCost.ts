import { roundMoney } from '@/lib/icFunds/currencyPolicy';
import { allocateLotAmount } from '@/lib/icTransfer/metalInventory';
import { netMetalInr } from '@/lib/icTransfer/labTest';
import { bookedMetalAed } from '@/lib/icTransfer/metalSplit';
import {
  computeMetalRateInrFromTotal,
  computeMetalSheetRateAed,
  IC_RATE_DECIMAL_PLACES,
  METAL_WEIGHT_DECIMALS,
  metalSaleFieldsFromRecord,
  type MetalSettlementFields,
} from '@/lib/icTransfer/metalSettlement';

function roundWeight(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(METAL_WEIGHT_DECIMALS));
}

function roundRate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(IC_RATE_DECIMAL_PLACES));
}

export type MetalLotSalePick = {
  metalWeightG: number;
  metalRateInrPerG?: number | null;
  metalRateAedPerG?: number | null;
  inrTotal?: number | null;
  aedTotal?: number | null;
  unitRate?: number | null;
};

/** Prefill metal sale amounts from a purchase lot (pro-rata when selling part of the lot). */
export function metalSaleFieldsFromMetalLotSelection(
  lot: MetalLotSalePick,
  sellG: number,
): MetalSettlementFields {
  const purchasedG = Number(lot.metalWeightG) || 0;
  const sell = roundWeight(sellG);
  if (sell <= 0 || purchasedG <= 0) {
    return metalSaleFieldsFromRecord({});
  }

  const grossInrLot = roundMoney(Number(lot.inrTotal) || 0);
  let metalRateInrPerG = roundRate(Number(lot.metalRateInrPerG) || 0);
  if (metalRateInrPerG <= 0 && grossInrLot > 0) {
    try {
      metalRateInrPerG = computeMetalRateInrFromTotal(purchasedG, grossInrLot);
    } catch {
      metalRateInrPerG = 0;
    }
  }

  const inrTotal =
    metalRateInrPerG > 0
      ? roundMoney(sell * metalRateInrPerG)
      : grossInrLot > 0
        ? roundMoney(allocateLotAmount(grossInrLot, sell, purchasedG))
        : 0;

  const sheetRateStored = roundRate(Number(lot.unitRate) || 0);
  const aedLot = roundMoney(Number(lot.aedTotal) || 0);
  const allocatedAed = aedLot > 0 ? roundMoney(allocateLotAmount(aedLot, sell, purchasedG)) : 0;

  let unitRate = sheetRateStored;
  if (unitRate <= 0 && allocatedAed > 0 && inrTotal > 0) {
    unitRate = computeMetalSheetRateAed(inrTotal, allocatedAed);
  }

  const fields = metalSaleFieldsFromRecord({
    metalWeightG: sell,
    metalRateInrPerG,
    metalRateAedPerG: Number(lot.metalRateAedPerG) || undefined,
    inrTotal,
    aedTotal: allocatedAed,
    unitRate: unitRate > 0 ? unitRate : undefined,
  });

  if (unitRate > 0 && fields.aedTotal <= 0 && inrTotal > 0) {
    return {
      ...fields,
      metalSheetRateAed: unitRate,
      aedTotal: roundMoney((inrTotal * unitRate) / 1_000),
    };
  }

  return fields;
}

/** Pro-rata lot INR cost (net of lab test) — never treat missing lot weight as a full-lot sell. */
export function allocateMetalLotCostInr(
  lot: { inrTotal?: number | null; metalWeightG?: number | null; labTotalInr?: number | null } | undefined,
  saleG: number,
): number {
  if (!lot || saleG <= 0) return 0;
  const purchasedG = Number(lot.metalWeightG);
  const inr = netMetalInr(Number(lot.inrTotal) || 0, Number(lot.labTotalInr) || 0);
  if (!Number.isFinite(purchasedG) || purchasedG <= 0 || inr <= 0) return 0;
  return allocateLotAmount(inr, saleG, purchasedG);
}

/** Pro-rata lot AED cost (agent metal). */
export function allocateMetalLotCostAed(
  lot: { aedTotal?: number | null; metalWeightG?: number | null } | undefined,
  saleG: number,
): number {
  if (!lot || saleG <= 0) return 0;
  const purchasedG = Number(lot.metalWeightG);
  const aed = Number(lot.aedTotal) || 0;
  if (!Number.isFinite(purchasedG) || purchasedG <= 0 || aed <= 0) return 0;
  return allocateLotAmount(aed, saleG, purchasedG);
}

/** Pro-rata AED actually booked for a lot: full AED total for AED deals, paid AED leg for split deals. */
export function allocateMetalLotBookedCostAed(
  lot: {
    aedTotal?: number | null;
    splitAedPaid?: number | null;
    metalWeightG?: number | null;
    metalRateAedPerG?: number | null;
    paymentMethod?: string | null;
    metalPaymentMethod?: string | null;
  } | undefined,
  saleG: number,
): number {
  if (!lot || saleG <= 0) return 0;
  const purchasedG = Number(lot.metalWeightG);
  if (!Number.isFinite(purchasedG) || purchasedG <= 0) return 0;
  const paymentMethod = lot.metalPaymentMethod ?? lot.paymentMethod;
  const aedTotal = Number(lot.aedTotal) ||
    (paymentMethod === 'AED' ? (Number(lot.metalRateAedPerG) || 0) * purchasedG : 0);
  const bookedAed = bookedMetalAed({
    paymentMethod,
    aedTotal,
    splitAedPaid: lot.splitAedPaid,
  });
  return allocateLotAmount(bookedAed, saleG, purchasedG);
}
