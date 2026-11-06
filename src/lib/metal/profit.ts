import { normalizeMetalPaymentMethod, type MetalPaymentMethod } from '@/lib/domain/books';

export type MetalLotProfitResult = {
  paymentMethod: MetalPaymentMethod;
  purchasePaymentMethod: MetalPaymentMethod;
  weightG: number;
  purchaseInr: number;
  saleInr: number;
  purchaseAed: number;
  saleAed: number;
  profitInr: number;
  profitAed: number;
  fxProfitAed: number;
};

function round4(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(4));
}

export function computeMetalLotProfit(params: {
  salePaymentMethod: string | null | undefined;
  purchasePaymentMethod: string | null | undefined;
  purchaseInr: number;
  purchaseAed: number;
  saleInr: number;
  saleAed: number;
  weightG: number;
}): MetalLotProfitResult {
  const salePaymentMethod = normalizeMetalPaymentMethod(params.salePaymentMethod);
  const purchasePaymentMethod = normalizeMetalPaymentMethod(params.purchasePaymentMethod);
  const purchaseInr = round4(params.purchaseInr);
  const saleInr = round4(params.saleInr);
  const purchaseAed = round4(params.purchaseAed);
  const saleAed = round4(params.saleAed);
  const profitInr = round4(saleInr - purchaseInr);
  const profitAed = round4(saleAed - purchaseAed);
  const fxProfitAed =
    salePaymentMethod === 'AED' && purchasePaymentMethod === 'AED' ? profitAed : 0;
  return {
    paymentMethod: salePaymentMethod,
    purchasePaymentMethod,
    weightG: round4(params.weightG),
    purchaseInr,
    saleInr,
    purchaseAed,
    saleAed,
    profitInr,
    profitAed,
    fxProfitAed,
  };
}

/** Metal P&L is INR only. AED agent amounts are balances, not profit. */
export function splitMetalBookedPl(pl: MetalLotProfitResult): { aed: number; inr: number } {
  return { aed: 0, inr: pl.profitInr };
}
