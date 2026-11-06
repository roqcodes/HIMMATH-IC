import { normalizeMetalPaymentMethod, type MetalPaymentMethod } from '@/lib/domain/books';
import { roundLedgerAmount } from '@/lib/icFunds/currencyPolicy';

export type MetalJournalBook = 'INR' | 'AED';

export type MetalJournalRole =
  | 'supplier'
  | 'customer'
  | 'agent'
  | 'metal_stock'
  | 'metal_sales'
  | 'metal_cost'
  | 'metal_profit'
  | 'metal_aed';

export type MetalJournalLine = {
  book: MetalJournalBook;
  referenceType: string;
  debit: MetalJournalRole;
  credit: MetalJournalRole;
  amount: number;
  label: string;
};

export type MetalPurchaseJournalInput = {
  paymentMethod: string | null | undefined;
  grossInr: number;
  labInr: number;
  aedTotal: number;
  hasAgent: boolean;
};

export type MetalSaleJournalInput = {
  completed: boolean;
  paymentMethod: string | null | undefined;
  /** Null when the sale is not linked to a lot. */
  lotPaymentMethod: string | null | undefined;
  hasLot: boolean;
  saleGrossInr: number;
  saleLabInr: number;
  saleAed: number;
  /** INR lot cost only when the lot was bought CASH (entered Metal Stock). */
  cashLotCostInr: number;
  hasAgent: boolean;
};

function amt(value: number): number {
  return roundLedgerAmount(Math.max(0, Number(value) || 0));
}

export function planMetalPurchaseJournals(input: MetalPurchaseJournalInput): MetalJournalLine[] {
  const pay = normalizeMetalPaymentMethod(input.paymentMethod);
  const grossInr = amt(input.grossInr);
  const labInr = amt(input.labInr);
  const aedTotal = amt(input.aedTotal);

  if (pay === 'CASH') {
    const lines: MetalJournalLine[] = [];
    if (grossInr > 0) {
      lines.push({
        book: 'INR',
        referenceType: 'metal_purchase',
        debit: 'metal_stock',
        credit: 'supplier',
        amount: grossInr,
        label: 'Bought metal',
      });
    }
    if (labInr > 0) {
      lines.push({
        book: 'INR',
        referenceType: 'lab_test_purchase',
        debit: 'supplier',
        credit: 'metal_stock',
        amount: labInr,
        label: 'Lab deducted (purchase)',
      });
    }
    return lines;
  }

  if (input.hasAgent && aedTotal > 0) {
    return [
      {
        book: 'AED',
        referenceType: 'metal_purchase_aed',
        debit: 'metal_aed',
        credit: 'agent',
        amount: aedTotal,
        label: 'Paid via agent',
      },
    ];
  }
  return [];
}

export function planMetalSaleJournals(input: MetalSaleJournalInput): MetalJournalLine[] {
  if (!input.completed) return [];

  const pay = normalizeMetalPaymentMethod(input.paymentMethod);
  const saleGrossInr = amt(input.saleGrossInr);
  const saleLabInr = amt(input.saleLabInr);
  const saleAed = amt(input.saleAed);
  const lotPay: MetalPaymentMethod | null = input.hasLot
    ? normalizeMetalPaymentMethod(input.lotPaymentMethod)
    : null;
  const cashLotCostInr = lotPay === 'CASH' ? amt(input.cashLotCostInr) : 0;

  if (pay === 'CASH') {
    const lines: MetalJournalLine[] = [];
    if (saleGrossInr > 0) {
      lines.push({
        book: 'INR',
        referenceType: 'metal_sale_receipt',
        debit: 'customer',
        credit: 'metal_sales',
        amount: saleGrossInr,
        label: 'Sold metal',
      });
    }
    if (saleLabInr > 0) {
      lines.push({
        book: 'INR',
        referenceType: 'lab_test_sale',
        debit: 'metal_sales',
        credit: 'customer',
        amount: saleLabInr,
        label: 'Lab deducted (sale)',
      });
    }
    if (cashLotCostInr > 0) {
      lines.push({
        book: 'INR',
        referenceType: 'metal_sale_cogs',
        debit: 'metal_cost',
        credit: 'metal_stock',
        amount: cashLotCostInr,
        label: 'Cost of metal sold',
      });
    }
    const netSaleInr = amt(Math.max(0, saleGrossInr - saleLabInr));
    const profit = roundLedgerAmount(netSaleInr - cashLotCostInr);
    if (profit > 0.005) {
      lines.push({
        book: 'INR',
        referenceType: 'metal_sale_profit',
        debit: 'metal_sales',
        credit: 'metal_profit',
        amount: profit,
        label: 'Metal profit',
      });
    } else if (profit < -0.005) {
      lines.push({
        book: 'INR',
        referenceType: 'metal_sale_profit',
        debit: 'metal_profit',
        credit: 'metal_cost',
        amount: Math.abs(profit),
        label: 'Metal loss',
      });
    }
    return lines;
  }

  const lines: MetalJournalLine[] = [];
  if (input.hasAgent && saleAed > 0) {
    lines.push({
      book: 'AED',
      referenceType: 'metal_sale_aed',
      debit: 'agent',
      credit: 'metal_aed',
      amount: saleAed,
      label: 'Collected via agent',
    });
  }
  if (cashLotCostInr > 0) {
    lines.push({
      book: 'INR',
      referenceType: 'metal_sale_cogs',
      debit: 'metal_cost',
      credit: 'metal_stock',
      amount: cashLotCostInr,
      label: 'Cost of metal sold',
    });
  }
  return lines;
}
