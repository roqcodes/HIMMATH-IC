import { normalizeMetalPaymentMethod } from '@/lib/domain/books';
import { roundLedgerAmount } from '@/lib/icFunds/currencyPolicy';
import { resolveDealSplitLegs } from '@/lib/icTransfer/metalSplit';

export type MetalJournalBook = 'INR' | 'AED';

export type MetalJournalRole =
  | 'supplier'
  | 'customer'
  | 'customer_aed'
  | 'agent'
  | 'aed_settlement'
  | 'metal_stock'
  | 'metal_sales'
  | 'metal_cost'
  | 'metal_profit'
  | 'metal_aed'
  | 'metal_aed_proceeds'
  | 'metal_fx';

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
  splitInrPaid?: number | null;
  splitAedPaid?: number | null;
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
  /** Pro-rata purchase-side INR cost for this sale slice (net of lab), from linked lot. */
  lotCostInrAllocated: number;
  /** Pro-rata purchase-side AED (agent metal lot). */
  lotPurchaseAedAllocated?: number;
  hasAgent: boolean;
  splitInrPaid?: number | null;
  splitAedPaid?: number | null;
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

  if (pay === 'SPLIT') {
    const legs = resolveDealSplitLegs({
      paymentMethod: 'SPLIT',
      grossInr,
      aedTotal,
      splitInrPaid: input.splitInrPaid,
      splitAedPaid: input.splitAedPaid,
    });
    const lines: MetalJournalLine[] = [];
    if (legs.paidInr > 0) {
      lines.push({
        book: 'INR',
        referenceType: 'metal_purchase',
        debit: 'metal_stock',
        credit: 'supplier',
        amount: legs.paidInr,
        label: 'Bought metal (INR)',
      });
    }
    if (legs.remainingInr > 0) {
      lines.push({
        book: 'INR',
        referenceType: 'metal_purchase',
        debit: 'metal_stock',
        credit: 'aed_settlement',
        amount: legs.remainingInr,
        label: 'Bought metal (AED share)',
      });
    }
    if (labInr > 0) {
      lines.push({
        book: 'INR',
        referenceType: 'lab_test_purchase',
        debit: 'aed_settlement',
        credit: 'metal_stock',
        amount: labInr,
        label: 'Lab deducted (purchase)',
      });
    }
    if (input.hasAgent && legs.paidAed > 0) {
      lines.push({
        book: 'AED',
        referenceType: 'metal_purchase_aed',
        debit: 'metal_aed',
        credit: 'customer_aed',
        amount: legs.paidAed,
        label: 'Paid via agent (split)',
      });
    }
    return lines;
  }

  if (pay === 'AED' && input.hasAgent && aedTotal > 0) {
    const lines: MetalJournalLine[] = [];
    if (grossInr > 0) {
      lines.push({
        book: 'INR',
        referenceType: 'metal_purchase',
        debit: 'metal_stock',
        credit: 'aed_settlement',
        amount: grossInr,
        label: 'Bought metal',
      });
    }
    if (labInr > 0) {
      lines.push({
        book: 'INR',
        referenceType: 'lab_test_purchase',
        debit: 'aed_settlement',
        credit: 'metal_stock',
        amount: labInr,
        label: 'Lab deducted (purchase)',
      });
    }
    lines.push({
      book: 'AED',
      referenceType: 'metal_purchase_aed',
      debit: 'metal_aed',
      credit: 'customer_aed',
      amount: aedTotal,
      label: 'Paid via agent',
    });
    return lines;
  }
  return [];
}

export function planMetalSaleJournals(input: MetalSaleJournalInput): MetalJournalLine[] {
  if (!input.completed) return [];

  const pay = normalizeMetalPaymentMethod(input.paymentMethod);
  const saleGrossInr = amt(input.saleGrossInr);
  const saleLabInr = amt(input.saleLabInr);
  const saleAed = amt(input.saleAed);
  const lotCostInr = input.hasLot ? amt(input.lotCostInrAllocated) : 0;

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
    if (lotCostInr > 0) {
      lines.push({
        book: 'INR',
        referenceType: 'metal_sale_cogs',
        debit: 'metal_cost',
        credit: 'metal_stock',
        amount: lotCostInr,
        label: 'Cost of metal sold',
      });
    }
    const netSaleInr = amt(Math.max(0, saleGrossInr - saleLabInr));
    const profit = roundLedgerAmount(netSaleInr - lotCostInr);
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

  if (pay === 'SPLIT') {
    const legs = resolveDealSplitLegs({
      paymentMethod: 'SPLIT',
      grossInr: saleGrossInr,
      aedTotal: saleAed,
      splitInrPaid: input.splitInrPaid,
      splitAedPaid: input.splitAedPaid,
    });
    const lines: MetalJournalLine[] = [];
    if (input.hasAgent && legs.paidAed > 0) {
      const lotPay = normalizeMetalPaymentMethod(input.lotPaymentMethod);
      const lotHasAed = lotPay === 'AED' || lotPay === 'SPLIT';
      const aedProceedsCredit: MetalJournalRole = lotHasAed ? 'metal_aed' : 'metal_aed_proceeds';
      lines.push({
        book: 'AED',
        referenceType: 'metal_sale_aed',
        debit: 'customer_aed',
        credit: aedProceedsCredit,
        amount: legs.paidAed,
        label: lotHasAed ? 'Collected via agent (split)' : 'AED proceeds (split)',
      });
      const lotAedCost = amt(input.lotPurchaseAedAllocated ?? 0);
      if (lotHasAed && lotAedCost > 0 && saleAed > 0) {
        const aedCostSlice = amt((lotAedCost * legs.paidAed) / saleAed);
        const fx = roundLedgerAmount(legs.paidAed - aedCostSlice);
        if (fx > 0.005) {
          lines.push({
            book: 'AED',
            referenceType: 'metal_fx_profit',
            debit: 'metal_aed',
            credit: 'metal_fx',
            amount: fx,
            label: 'Metal FX (AED)',
          });
        } else if (fx < -0.005) {
          lines.push({
            book: 'AED',
            referenceType: 'metal_fx_profit',
            debit: 'metal_fx',
            credit: 'metal_aed',
            amount: Math.abs(fx),
            label: 'Metal FX loss (AED)',
          });
        }
      }
    }
    if (legs.paidInr > 0) {
      lines.push({
        book: 'INR',
        referenceType: 'metal_sale_receipt',
        debit: 'customer',
        credit: 'metal_sales',
        amount: legs.paidInr,
        label: 'Sold metal (INR)',
      });
    }
    if (legs.remainingInr > 0) {
      lines.push({
        book: 'INR',
        referenceType: 'metal_sale_receipt',
        debit: 'aed_settlement',
        credit: 'metal_sales',
        amount: legs.remainingInr,
        label: 'Sold metal (AED share)',
      });
    }
    if (saleLabInr > 0) {
      lines.push({
        book: 'INR',
        referenceType: 'lab_test_sale',
        debit: 'metal_sales',
        credit: 'aed_settlement',
        amount: saleLabInr,
        label: 'Lab deducted (sale)',
      });
    }
    if (lotCostInr > 0) {
      lines.push({
        book: 'INR',
        referenceType: 'metal_sale_cogs',
        debit: 'metal_cost',
        credit: 'metal_stock',
        amount: lotCostInr,
        label: 'Cost of metal sold',
      });
    }
    const netSaleInr = amt(Math.max(0, saleGrossInr - saleLabInr));
    const profit = roundLedgerAmount(netSaleInr - lotCostInr);
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
  const settledViaAgent = input.hasAgent && saleAed > 0;
  const inrBillParty: MetalJournalRole = settledViaAgent ? 'aed_settlement' : 'customer';

  if (settledViaAgent) {
    const lotPay = normalizeMetalPaymentMethod(input.lotPaymentMethod);
    const lotHasAedBooked = lotPay === 'AED' || lotPay === 'SPLIT';
    const aedProceedsCredit: MetalJournalRole =
      lotHasAedBooked ? 'metal_aed' : 'metal_aed_proceeds';
    lines.push({
      book: 'AED',
      referenceType: 'metal_sale_aed',
      debit: 'customer_aed',
      credit: aedProceedsCredit,
      amount: saleAed,
      label: lotHasAedBooked ? 'Collected via agent' : 'AED proceeds (INR-cost lot)',
    });
    const lotAedCost = amt(input.lotPurchaseAedAllocated ?? 0);
    if (lotHasAedBooked && lotAedCost > 0) {
      const fx = roundLedgerAmount(saleAed - lotAedCost);
      if (fx > 0.005) {
        lines.push({
          book: 'AED',
          referenceType: 'metal_fx_profit',
          debit: 'metal_aed',
          credit: 'metal_fx',
          amount: fx,
          label: 'Metal FX (AED)',
        });
      } else if (fx < -0.005) {
        lines.push({
          book: 'AED',
          referenceType: 'metal_fx_profit',
          debit: 'metal_fx',
          credit: 'metal_aed',
          amount: Math.abs(fx),
          label: 'Metal FX loss (AED)',
        });
      }
    }
  }
  if (saleGrossInr > 0) {
    lines.push({
      book: 'INR',
      referenceType: 'metal_sale_receipt',
      debit: inrBillParty,
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
      credit: inrBillParty,
      amount: saleLabInr,
      label: 'Lab deducted (sale)',
    });
  }
  if (lotCostInr > 0) {
    lines.push({
      book: 'INR',
      referenceType: 'metal_sale_cogs',
      debit: 'metal_cost',
      credit: 'metal_stock',
      amount: lotCostInr,
      label: 'Cost of metal sold',
    });
  }
  const netSaleInr = amt(Math.max(0, saleGrossInr - saleLabInr));
  const profit = roundLedgerAmount(netSaleInr - lotCostInr);
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
