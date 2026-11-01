import { isVoidIcSaleOrderStatus } from '../icFunds/icTransferReportFilters';
import {
  type MetalSettlementInput,
  validateMetalSettlementInput,
} from './metalSettlement';

export const METAL_PAYMENT_METHODS = ['INR', 'AED'] as const;
export type MetalPaymentMethod = (typeof METAL_PAYMENT_METHODS)[number];

const WEIGHT_EPS = 0.0001;
const AMOUNT_DECIMALS = 4;

function round4(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(AMOUNT_DECIMALS));
}

export function isMetalPaymentMethod(value: string | null | undefined): value is MetalPaymentMethod {
  return value === 'INR' || value === 'AED';
}

export type MetalLotSaleSlice = {
  metalWeightG?: number | null;
  orderStatus?: string | null;
};

export type MetalLotPurchase = {
  id: string;
  warehouseId?: string | null;
  metalWeightG?: number | null;
  metalRateInrPerG?: number | null;
  metalRateAedPerG?: number | null;
  inrTotal?: number | null;
  aedTotal?: number | null;
  createdAt?: string | null;
};

/** Grams still on a purchase lot (open for partial sells later). */
export function remainingMetalGramsOnLot(
  purchasedG: number,
  sales: MetalLotSaleSlice[],
): number {
  const sold = sales.reduce((sum, sale) => {
    if (isVoidIcSaleOrderStatus(sale.orderStatus)) return sum;
    return sum + (Number(sale.metalWeightG) || 0);
  }, 0);
  return round4(Math.max(0, (Number(purchasedG) || 0) - sold));
}

export function isFullLotSell(purchasedG: number, remainingG: number): boolean {
  return Math.abs(remainingG - purchasedG) < WEIGHT_EPS && remainingG > 0;
}

/** Pro-rata a lot amount by grams sold — ready for partial sells later. */
export function allocateLotAmount(lotTotal: number, sellG: number, purchasedG: number): number {
  const purchased = Number(purchasedG) || 0;
  if (purchased <= 0) return 0;
  return round4((Number(lotTotal) || 0) * ((Number(sellG) || 0) / purchased));
}

export function isFullRemainingSell(sellG: number, remainingG: number): boolean {
  return Math.abs((Number(sellG) || 0) - (Number(remainingG) || 0)) < WEIGHT_EPS && remainingG > 0;
}

export type MetalLotProfit = {
  paymentMethod: MetalPaymentMethod;
  weightG: number;
  purchaseInr: number;
  saleInr: number;
  purchaseAed: number;
  saleAed: number;
  profitInr: number;
  profitAed: number;
  /** Booked P&L in the payment currency. */
  bookedProfit: number;
  bookedCurrency: 'AED';
};

export function computeMetalLotProfit(params: {
  paymentMethod: MetalPaymentMethod;
  purchaseInr: number;
  purchaseAed: number;
  saleInr: number;
  saleAed: number;
  weightG: number;
}): MetalLotProfit {
  const purchaseInr = round4(params.purchaseInr);
  const saleInr = round4(params.saleInr);
  const purchaseAed = round4(params.purchaseAed);
  const saleAed = round4(params.saleAed);
  const profitInr = round4(saleInr - purchaseInr);
  const profitAed = round4(saleAed - purchaseAed);
  const paymentMethod = params.paymentMethod;
  return {
    paymentMethod,
    weightG: round4(params.weightG),
    purchaseInr,
    saleInr,
    purchaseAed,
    saleAed,
    profitInr,
    profitAed,
    /** Base currency (AED): sale AED − lot purchase AED. */
    bookedProfit: profitAed,
    bookedCurrency: 'AED',
  };
}

export type NormalizedMetalLotSale = {
  settlementMode: 'metal';
  metalPurchaseId: string;
  metalPaymentMethod: MetalPaymentMethod;
  metalWeightG: number;
  metalRateInrPerG: number;
  metalRateAedPerG: number;
  inrTotal: number;
  aedTotal: number;
  aedAmount: number;
  units: number;
  unitRate: number;
};

/**
 * Metal sale: customer pays AED; IC unit stock does not change.
 */
export function normalizeMetalLotSale(params: {
  metalPurchaseId: string;
  input: MetalSettlementInput;
}): NormalizedMetalLotSale {
  if (!params.metalPurchaseId.trim()) {
    throw new Error('Select the metal purchase to sell.');
  }
  validateMetalSettlementInput(params.input);
  const inrTotal = round4(params.input.totalInr);
  const aedTotal = round4(params.input.totalAed);
  return {
    settlementMode: 'metal',
    metalPurchaseId: params.metalPurchaseId,
    metalPaymentMethod: 'AED',
    metalWeightG: round4(params.input.metalWeightG),
    metalRateInrPerG: round4(params.input.metalRateInrPerG),
    metalRateAedPerG: round4(params.input.metalRateAedPerG),
    inrTotal,
    aedTotal,
    aedAmount: aedTotal,
    units: 0,
    unitRate: 0,
  };
}

export function formatMetalLotLabel(lot: {
  metalWeightG?: number | null;
  inrTotal?: number | null;
  aedTotal?: number | null;
  createdAt?: string | null;
}): string {
  const g = Number(lot.metalWeightG) || 0;
  const kg = g >= 1000 ? `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 3)} kg` : `${g.toFixed(2)} g`;
  const day = lot.createdAt ? String(lot.createdAt).slice(0, 10) : '';
  return [day, kg].filter(Boolean).join(' · ');
}
