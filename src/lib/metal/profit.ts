import { roundMoney } from '@/lib/icFunds/currencyPolicy';
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

function money(value: number): number {
  return roundMoney(value);
}

export function computeMetalLotProfit(params: {
  salePaymentMethod: string | null | undefined;
  purchasePaymentMethod: string | null | undefined;
  purchaseInr: number;
  purchaseAed: number;
  saleInr: number;
  saleAed: number;
  saleSplitAedPaid?: number;
  weightG: number;
}): MetalLotProfitResult {
  const salePaymentMethod = normalizeMetalPaymentMethod(params.salePaymentMethod);
  const purchasePaymentMethod = normalizeMetalPaymentMethod(params.purchasePaymentMethod);
  const purchaseInr = money(params.purchaseInr);
  const saleInr = money(params.saleInr);
  const purchaseAed = money(params.purchaseAed);
  const saleAed = money(params.saleAed);
  const profitInr = money(saleInr - purchaseInr);
  const profitAed = money(saleAed - purchaseAed);
  const purchaseHasAed = purchasePaymentMethod === 'AED' || purchasePaymentMethod === 'SPLIT';
  const saleHasAed = salePaymentMethod === 'AED' || salePaymentMethod === 'SPLIT';
  // purchaseAed is already prorated by grams and reflects the booked AED leg for split lots.
  const bookedPurchaseAed = purchaseHasAed ? purchaseAed : 0;
  const bookedSaleAed = salePaymentMethod === 'SPLIT'
    ? money(params.saleSplitAedPaid ?? 0)
    : salePaymentMethod === 'AED' ? saleAed : 0;
  const fxProfitAed = purchaseHasAed && saleHasAed
    ? money(bookedSaleAed - bookedPurchaseAed)
    : 0;
  return {
    paymentMethod: salePaymentMethod,
    purchasePaymentMethod,
    weightG: Number((Number(params.weightG) || 0).toFixed(4)),
    purchaseInr,
    saleInr,
    purchaseAed,
    saleAed,
    profitInr,
    profitAed,
    fxProfitAed,
  };
}

/** Keep the INR metal margin and AED FX margin in their respective books. */
export function splitMetalBookedPl(pl: MetalLotProfitResult): { aed: number; inr: number } {
  return { aed: pl.fxProfitAed, inr: pl.profitInr };
}
