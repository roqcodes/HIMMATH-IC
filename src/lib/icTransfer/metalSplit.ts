import { roundMoney } from '@/lib/icFunds/currencyPolicy';
import {
  inrAmountToUnits,
  normalizeMetalPaymentMethod,
  type MetalPaymentMethod,
} from '@/lib/domain/books';
import { netMetalInr } from '@/lib/icTransfer/labTest';

const EPS = 0.01;

function money(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return roundMoney(n);
}

export type MetalSplitAmounts = {
  paidInr: number;
  paidAed: number;
};

/** AED booked for the leftover INR at the deal's INR↔AED sheet. */
export function complementSplitAed(paidInr: number, totalInr: number, totalAed: number): number {
  const tInr = money(totalInr);
  const tAed = money(totalAed);
  if (tInr <= 0 || tAed <= 0) return 0;
  const paid = Math.min(tInr, money(paidInr));
  const remainingInr = Math.max(0, tInr - paid);
  return money((remainingInr / tInr) * tAed);
}

/** INR booked for the leftover AED at the deal's INR↔AED sheet. */
export function complementSplitInr(paidAed: number, totalInr: number, totalAed: number): number {
  const tInr = money(totalInr);
  const tAed = money(totalAed);
  if (tInr <= 0 || tAed <= 0) return 0;
  const paid = Math.min(tAed, money(paidAed));
  const remainingAed = Math.max(0, tAed - paid);
  return money((remainingAed / tAed) * tInr);
}

export function defaultSplitAmounts(totalInr: number, totalAed: number): MetalSplitAmounts {
  const tInr = money(totalInr);
  const half = money(tInr / 2);
  return {
    paidInr: half,
    paidAed: complementSplitAed(half, tInr, totalAed),
  };
}

/**
 * Server-side canonicalize: INR paid is the driver; AED paid is the leftover at sheet rate.
 * If INR paid is empty, AED paid drives instead.
 */
export function finalizeSplitAmounts(
  totalInr: number,
  totalAed: number,
  paidInr?: number | null,
  paidAed?: number | null,
): MetalSplitAmounts {
  const tInr = money(totalInr);
  const tAed = money(totalAed);
  const inr = money(paidInr ?? 0);
  const aed = money(paidAed ?? 0);
  if (inr > EPS) {
    const clampedInr = Math.min(inr, Math.max(0, tInr - EPS));
    return { paidInr: money(clampedInr), paidAed: complementSplitAed(clampedInr, tInr, tAed) };
  }
  if (aed > EPS) {
    const clampedAed = Math.min(aed, Math.max(0, tAed - EPS));
    return { paidInr: complementSplitInr(clampedAed, tInr, tAed), paidAed: money(clampedAed) };
  }
  return defaultSplitAmounts(tInr, tAed);
}

export function assertSplitAmounts(totalInr: number, totalAed: number, split: MetalSplitAmounts): void {
  const tInr = money(totalInr);
  const tAed = money(totalAed);
  if (tInr <= 0) throw new Error('Total INR is required for a split payment.');
  if (tAed <= 0) throw new Error('Total AED is required for a split payment.');
  if (split.paidInr <= EPS) throw new Error('Enter how much is in INR.');
  if (split.paidAed <= EPS) throw new Error('AED paid must be greater than zero.');
  if (split.paidInr >= tInr - EPS) {
    throw new Error('INR paid must be less than total INR — use Cash for a full INR deal.');
  }
  if (split.paidAed >= tAed - EPS) {
    throw new Error('AED paid must be less than total AED — use AED for a full AED deal.');
  }
}

export function resolveDealSplitLegs(input: {
  paymentMethod?: string | null;
  grossInr: number;
  aedTotal: number;
  splitInrPaid?: number | null;
  splitAedPaid?: number | null;
}): MetalSplitAmounts & { remainingInr: number } {
  const pay = normalizeMetalPaymentMethod(input.paymentMethod);
  const grossInr = money(input.grossInr);
  const aedTotal = money(input.aedTotal);
  if (pay === 'CASH') {
    return { paidInr: grossInr, paidAed: 0, remainingInr: 0 };
  }
  if (pay === 'AED') {
    return { paidInr: 0, paidAed: aedTotal, remainingInr: grossInr };
  }
  const storedInr = money(input.splitInrPaid ?? 0);
  const storedAed = money(input.splitAedPaid ?? 0);
  if (storedInr <= EPS && storedAed <= EPS) {
    throw new Error('Split payment amounts are missing on this deal.');
  }
  const split = finalizeSplitAmounts(grossInr, aedTotal, input.splitInrPaid, input.splitAedPaid);
  assertSplitAmounts(grossInr, aedTotal, split);
  return { ...split, remainingInr: money(Math.max(0, grossInr - split.paidInr)) };
}

/**
 * INR on the counterparty ledger (KPIs, statements, WAC units).
 * CASH metal: gross INR net of lab. SPLIT: stored `split_inr_paid` only (lab stays on settlement in journals).
 * Deal "total INR" in tables may still show full net — do not confuse with this booked leg.
 */
export function bookedMetalInr(input: {
  paymentMethod?: string | null;
  inrTotal?: number | null;
  labTotalInr?: number | null;
  splitInrPaid?: number | null;
}): number {
  const pay = normalizeMetalPaymentMethod(input.paymentMethod);
  if (pay === 'AED') return 0;
  const gross = money(input.inrTotal ?? 0);
  const net = netMetalInr(gross, Number(input.labTotalInr) || 0);
  if (pay !== 'SPLIT') return net;
  return money(input.splitInrPaid ?? 0);
}

/** AED booked with the agent (split uses stored AED paid; full AED uses whole total). */
export function bookedMetalAed(input: {
  paymentMethod?: string | null;
  aedTotal?: number | null;
  splitAedPaid?: number | null;
}): number {
  const pay = normalizeMetalPaymentMethod(input.paymentMethod);
  if (pay === 'CASH') return 0;
  if (pay === 'SPLIT') return money(input.splitAedPaid ?? 0);
  return money(input.aedTotal ?? 0);
}

export function metalPaymentShortLabel(method: MetalPaymentMethod | string | null | undefined): string {
  const pay = normalizeMetalPaymentMethod(method);
  if (pay === 'SPLIT') return 'Split';
  if (pay === 'AED') return 'AED';
  return 'INR';
}

/** IC WAC pool units from metal INR leg only (full cash metal or split INR-paid share). */
export function metalInrSaleIcUnitsFromFields(fields: {
  settlementMode?: string | null;
  metalPaymentMethod?: string | null;
  units?: number | null;
  inrTotal?: number | null;
  labTotalInr?: number | null;
  splitInrPaid?: number | null;
}): number {
  if (String(fields.settlementMode || '') !== 'metal') return 0;
  const pay = normalizeMetalPaymentMethod(fields.metalPaymentMethod);
  if (pay === 'AED') return 0;
  if (pay === 'SPLIT') {
    const inr = bookedMetalInr({
      paymentMethod: 'SPLIT',
      inrTotal: fields.inrTotal,
      labTotalInr: fields.labTotalInr,
      splitInrPaid: fields.splitInrPaid,
    });
    return inrAmountToUnits(inr);
  }
  return Number(fields.units) || 0;
}
