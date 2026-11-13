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
  const fxProfitAed =
    salePaymentMethod === 'AED' && purchasePaymentMethod === 'AED' ? profitAed : 0;
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

/** Metal P&L is INR only. AED agent amounts are balances, not profit. */
export function splitMetalBookedPl(pl: MetalLotProfitResult): { aed: number; inr: number } {
  return { aed: 0, inr: pl.profitInr };
}
