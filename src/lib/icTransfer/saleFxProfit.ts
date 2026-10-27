/** Type 2 FX profit: sale-time rate vs collection settlement rate on foreign received. */

export type SaleFxSettlementAmounts = {
  paidForeign: number;
  settlementRate: number;
  saleConversionRate: number;
  settledAed: number;
  bookedAed: number;
  type2ProfitAed: number;
};

/** Max precision for FX settlement math and storage (matches rate columns). */
export const FX_CALC_DECIMAL_PLACES = 14;

/** Max fractional digits shown in UI (trailing zeros omitted). Calculations use FX_CALC_DECIMAL_PLACES. */
export const FX_DISPLAY_DECIMAL_PLACES = 4;

/** Clamp float noise only — keep full calculation precision. */
export function roundFxCalc(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(FX_CALC_DECIMAL_PLACES));
}

/** Show up to 4 decimal places when needed; omit trailing zeros. */
export function formatFxAmount(
  value: number,
  maxFractionDigits: number = FX_DISPLAY_DECIMAL_PLACES,
): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return '0';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  });
}

export function isForeignCurrencySale(currency?: string | null, conversionRate?: number | null): boolean {
  const cur = currency?.trim().toUpperCase();
  if (!cur || cur === 'AED' || cur === 'CURRENCY') return false;
  const rate = Number(conversionRate);
  return Number.isFinite(rate) && rate > 0 && Math.abs(rate - 1) > 1e-9;
}

export function computeSaleFxSettlementAmounts(
  paidForeign: number,
  settlementRate: number,
  saleConversionRate: number,
): SaleFxSettlementAmounts {
  const paid = Number(paidForeign);
  const settle = Number(settlementRate);
  const saleRate = Number(saleConversionRate);
  if (!Number.isFinite(paid) || paid <= 0) {
    throw new Error('Paid foreign amount must be greater than zero');
  }
  if (!Number.isFinite(settle) || settle <= 0) {
    throw new Error('Settlement rate must be greater than zero');
  }
  if (!Number.isFinite(saleRate) || saleRate <= 0) {
    throw new Error('Sale conversion rate must be greater than zero');
  }

  const settledAed = roundFxCalc(paid / settle);
  const bookedAed = roundFxCalc(paid / saleRate);
  const type2ProfitAed = roundFxCalc(settledAed - bookedAed);

  return {
    paidForeign: paid,
    settlementRate: settle,
    saleConversionRate: saleRate,
    settledAed,
    bookedAed,
    type2ProfitAed,
  };
}

export function resolveSaleForeignPaymentStatus(
  convertedAmount: number | null | undefined,
  totalPaidForeign: number,
): 'pending' | 'partial' | 'paid' {
  const owed = Number(convertedAmount) || 0;
  const paid = Number(totalPaidForeign) || 0;
  if (owed <= 0) return paid > 0 ? 'paid' : 'pending';
  if (paid >= owed - 1e-10) return 'paid';
  if (paid > 0) return 'partial';
  return 'pending';
}

export function remainingForeignOwed(
  convertedAmount: number | null | undefined,
  totalPaidForeign: number,
): number {
  const owed = Number(convertedAmount) || 0;
  const paid = Number(totalPaidForeign) || 0;
  return roundFxCalc(Math.max(0, owed - paid));
}

export type FxOpenSaleLine = {
  saleId: string;
  units: number;
  unitRate: number;
  aedAmount: number;
  convertedAmount: number;
  conversionRate: number;
  foreignRemaining: number;
  /** ISO timestamp for FIFO ordering (oldest first). */
  createdAt?: string;
};

export type FxBatchAllocation = {
  saleId: string;
  paidForeign: number;
  settlementRate: number;
};

/** Sales that still have foreign balance — used for weighted averages. */
export function salesWithRemainingBalance(sales: FxOpenSaleLine[]): FxOpenSaleLine[] {
  return sales.filter(row => row.foreignRemaining > 1e-10);
}

/** Oldest sale first (FIFO settlement order). */
export function sortSalesFifo(sales: FxOpenSaleLine[]): FxOpenSaleLine[] {
  return [...sales].sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    if (ta !== tb) return ta - tb;
    return a.saleId.localeCompare(b.saleId);
  });
}

/** Apply one receipt across open sales in FIFO order. */
export function buildFifoAllocations(
  salesOrdered: FxOpenSaleLine[],
  totalPaidForeign: number,
  settlementRate: number,
): FxBatchAllocation[] {
  const paid = Number(totalPaidForeign);
  const settle = Number(settlementRate);
  if (!Number.isFinite(paid) || paid <= 0) {
    throw new Error('Paid foreign amount must be greater than zero');
  }
  if (!Number.isFinite(settle) || settle <= 0) {
    throw new Error('Settlement rate must be greater than zero');
  }

  const active = sortSalesFifo(salesWithRemainingBalance(salesOrdered));
  const customerRemaining = roundFxCalc(active.reduce((s, row) => s + row.foreignRemaining, 0));
  if (paid > customerRemaining + 1e-10) {
    throw new Error(
      `Paid ${formatFxAmount(paid)} exceeds customer remaining ${formatFxAmount(customerRemaining)}`,
    );
  }

  let pool = paid;
  const allocs: FxBatchAllocation[] = [];
  for (const sale of active) {
    if (pool <= 1e-10) break;
    const applied = roundFxCalc(Math.min(pool, sale.foreignRemaining));
    if (applied <= 1e-10) continue;
    allocs.push({ saleId: sale.saleId, paidForeign: applied, settlementRate: settle });
    pool = roundFxCalc(pool - applied);
  }

  if (allocs.length === 0) {
    throw new Error('No open balance to settle for this customer');
  }
  return allocs;
}

export type FxAgentClosingSummary = {
  totalUnits: number;
  totalAed: number;
  avgSaleRateAed: number;
  totalSarOwed: number;
  totalSarRemaining: number;
  avgSaleConversionRate: number;
  totalPaidForeign: number;
  /** Weighted effective settlement rate (SAR per AED) across payment lines. */
  settlementRate: number;
  settledAed: number;
  bookedAedAtAvgRate: number;
  rateMargin: number;
  type2ProfitAtAvgRate: number;
  type2ProfitPerLine: number;
};

/** Weighted closing row (spreadsheet CLOSING TO AJEER) + per-line Type 2 sum. */
export function computeAgentGroupClosingSummary(
  sales: FxOpenSaleLine[],
  allocations: FxBatchAllocation[],
): FxAgentClosingSummary {
  const basis = salesWithRemainingBalance(sales);

  const totalSarRemaining = roundFxCalc(basis.reduce((s, row) => s + row.foreignRemaining, 0));
  const totalAedRemaining = roundFxCalc(
    basis.reduce((s, row) => s + row.foreignRemaining / row.conversionRate, 0),
  );
  const totalUnits = roundFxCalc(
    basis.reduce((s, row) => {
      if (row.convertedAmount <= 1e-10) return s + row.units;
      const ratio = row.foreignRemaining / row.convertedAmount;
      return s + row.units * ratio;
    }, 0),
  );
  const avgSaleRateAed = totalUnits > 0 ? roundFxCalc(totalAedRemaining / totalUnits) : 0;
  const avgSaleConversionRate =
    totalAedRemaining > 0 ? roundFxCalc(totalSarRemaining / totalAedRemaining) : 0;

  const totalPaidForeign = roundFxCalc(allocations.reduce((s, row) => s + row.paidForeign, 0));
  const saleById = new Map(sales.map(row => [row.saleId, row]));

  let settledAed = 0;
  let type2ProfitPerLine = 0;
  for (const alloc of allocations) {
    const sale = saleById.get(alloc.saleId);
    if (!sale) throw new Error('Allocation references unknown sale');
    const line = computeSaleFxSettlementAmounts(
      alloc.paidForeign,
      alloc.settlementRate,
      sale.conversionRate,
    );
    settledAed = roundFxCalc(settledAed + line.settledAed);
    type2ProfitPerLine = roundFxCalc(type2ProfitPerLine + line.type2ProfitAed);
  }

  const effectiveSettlementRate =
    totalPaidForeign > 0 && settledAed > 0 ? roundFxCalc(totalPaidForeign / settledAed) : 0;
  const bookedAedAtAvgRate =
    totalPaidForeign > 0 && avgSaleConversionRate > 0
      ? roundFxCalc(totalPaidForeign / avgSaleConversionRate)
      : 0;
  const rateMargin = roundFxCalc(avgSaleConversionRate - effectiveSettlementRate);
  const type2ProfitAtAvgRate = roundFxCalc(settledAed - bookedAedAtAvgRate);

  return {
    totalUnits,
    totalAed: totalAedRemaining,
    avgSaleRateAed,
    totalSarOwed: totalSarRemaining,
    totalSarRemaining,
    avgSaleConversionRate,
    totalPaidForeign,
    settlementRate: effectiveSettlementRate,
    settledAed,
    bookedAedAtAvgRate,
    rateMargin,
    type2ProfitAtAvgRate,
    type2ProfitPerLine,
  };
}

export function validateBatchFxAllocations(
  sales: FxOpenSaleLine[],
  allocations: FxBatchAllocation[],
): void {
  if (allocations.length === 0) {
    throw new Error('Add at least one payment line');
  }

  const saleById = new Map(sales.map(row => [row.saleId, row]));
  let totalPaid = 0;
  const paidBySale = new Map<string, number>();
  const totalGroupRemaining = roundFxCalc(sales.reduce((s, row) => s + row.foreignRemaining, 0));

  for (const alloc of allocations) {
    const paid = Number(alloc.paidForeign);
    const settle = Number(alloc.settlementRate);
    if (!Number.isFinite(paid) || paid <= 0) {
      throw new Error('Each payment amount must be greater than zero');
    }
    if (!Number.isFinite(settle) || settle <= 0) {
      throw new Error('Each settlement rate must be greater than zero');
    }
    if (!saleById.has(alloc.saleId)) {
      throw new Error('Payment references a sale outside this agent group');
    }
    totalPaid = roundFxCalc(totalPaid + paid);
    paidBySale.set(alloc.saleId, roundFxCalc((paidBySale.get(alloc.saleId) || 0) + paid));
  }

  for (const [saleId, paid] of paidBySale) {
    const remaining = saleById.get(saleId)?.foreignRemaining ?? 0;
    if (paid > remaining + 1e-10) {
      throw new Error(
        `Paid ${formatFxAmount(paid)} exceeds remaining ${formatFxAmount(remaining)} on a sale`,
      );
    }
  }

  if (totalPaid > totalGroupRemaining + 1e-10) {
    throw new Error(
      `Total paid ${formatFxAmount(totalPaid)} exceeds group remaining ${formatFxAmount(totalGroupRemaining)}`,
    );
  }
}
