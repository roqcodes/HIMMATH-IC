import { isVoidIcSaleOrderStatus } from '../icFunds/icTransferReportFilters';
import { type MetalSettlementInput, normalizeMetalSale } from './metalSettlement';
import { normalizeMetalPaymentMethod } from '@/lib/domain/books';
import {
  computeMetalLotProfit as computeMetalLotProfitCore,
  splitMetalBookedPl,
} from '@/lib/metal/profit';

export const METAL_PAYMENT_METHODS = ['CASH', 'AED'] as const;
export type MetalPaymentMethod = (typeof METAL_PAYMENT_METHODS)[number];

const WEIGHT_EPS = 0.0001;
const AMOUNT_DECIMALS = 4;

function round4(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(AMOUNT_DECIMALS));
}

export function isMetalPaymentMethod(value: string | null | undefined): value is MetalPaymentMethod {
  return value === 'CASH' || value === 'AED' || value === 'INR';
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
  /** Primary booked P&L amount for single-currency display. */
  bookedProfit: number;
  bookedCurrency: 'AED' | 'INR';
  bookedProfitAed: number;
  bookedProfitInr: number;
};

export function computeMetalLotProfit(params: {
  paymentMethod?: string | null;
  purchasePaymentMethod?: string | null;
  purchaseInr: number;
  purchaseAed: number;
  saleInr: number;
  saleAed: number;
  weightG: number;
}): MetalLotProfit {
  const fromModule = computeMetalLotProfitCore({
    salePaymentMethod: params.paymentMethod,
    purchasePaymentMethod: params.purchasePaymentMethod ?? params.paymentMethod,
    purchaseInr: params.purchaseInr,
    purchaseAed: params.purchaseAed,
    saleInr: params.saleInr,
    saleAed: params.saleAed,
    weightG: params.weightG,
  });
  const booked = splitMetalBookedPl(fromModule);
  return {
    paymentMethod: fromModule.paymentMethod,
    weightG: fromModule.weightG,
    purchaseInr: fromModule.purchaseInr,
    saleInr: fromModule.saleInr,
    purchaseAed: fromModule.purchaseAed,
    saleAed: fromModule.saleAed,
    profitInr: fromModule.profitInr,
    profitAed: fromModule.profitAed,
    bookedProfit: booked.inr,
    bookedCurrency: 'INR',
    bookedProfitAed: booked.aed,
    bookedProfitInr: booked.inr,
  };
}

export type NormalizedMetalLotSale = {
  settlementMode: 'metal';
  metalPurchaseId: string;
  metalPaymentMethod: MetalPaymentMethod;
  aedAgentId?: string | null;
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
 * Metal sale: INR grams + IC unit AED rate. Cash payment puts those units into IC stock at that AED cost.
 * AED payment collects AED via agent and does not add IC units.
 */
export function normalizeMetalLotSale(params: {
  metalPurchaseId: string;
  input: MetalSettlementInput;
  paymentMethod?: string | null;
  aedAgentId?: string | null;
}): NormalizedMetalLotSale {
  if (!params.metalPurchaseId.trim()) {
    throw new Error('Select the metal purchase to sell.');
  }
  const sale = normalizeMetalSale(params.input, 0, {
    paymentMethod: params.paymentMethod,
    aedAgentId: params.aedAgentId,
  });
  return {
    settlementMode: 'metal',
    metalPurchaseId: params.metalPurchaseId,
    metalPaymentMethod: sale.metalPaymentMethod,
    aedAgentId: sale.aedAgentId,
    metalWeightG: sale.metalWeightG,
    metalRateInrPerG: sale.metalRateInrPerG,
    metalRateAedPerG: sale.metalRateAedPerG,
    inrTotal: sale.inrTotal,
    aedTotal: sale.aedTotal ?? sale.aedAmount,
    aedAmount: sale.aedAmount,
    units: sale.units,
    unitRate: sale.unitRate,
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
