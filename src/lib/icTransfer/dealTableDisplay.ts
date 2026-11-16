import React from 'react';
import CurrencyAmount from '@/components/currency/CurrencyAmount';
import { fmtLedgerAed, fmtLedgerInr } from '@/lib/icFunds/format';
import { isMetalAedPayment, isMetalSplitPayment } from '@/lib/domain/books';
import { dealPurchaseAed, dealSaleAed } from '@/lib/icTransfer/dealBookKpis';
import { netMetalInr } from '@/lib/icTransfer/labTest';
import { computeMetalAedFromInr, computeMetalSheetRateAed, resolvePurchaseInrDisplay, resolveSaleInrDisplay } from '@/lib/icTransfer/metalSettlement';
import { computeIcCashAedTotal, computeIcCashRateFromTotals, formatRateAmount } from '@/lib/icTransfer/rateCalculations';
import type { ICPurchase, ICSale } from '@/types';
import type { SaleLineProfit } from '@/lib/icTransfer/dealProfit';

export function purchaseDealInr(
  p: Pick<ICPurchase, 'settlementMode' | 'inrTotal' | 'units' | 'labTotalInr'>,
): number {
  return resolvePurchaseInrDisplay(p);
}

export function saleDealInr(
  s: Pick<ICSale, 'settlementMode' | 'inrTotal' | 'units' | 'labTotalInr'>,
): number {
  return resolveSaleInrDisplay(s);
}

export function formatDealTableInr(amount: number): React.ReactNode {
  return React.createElement(CurrencyAmount, { currency: 'INR', amount, zeroDisplay: '—' });
}

/** Booked AED only — cash-metal memo rates are hidden. */
export function purchaseDealAed(p: ICPurchase): number {
  return dealPurchaseAed(p);
}

export function saleDealAed(s: ICSale): number {
  return dealSaleAed(s);
}

/**
 * AED for **table/UX** when the booked AED leg is intentionally empty:
 * - Metal · INR: implied from net INR × sheet RATE ÷ 1000 (`unit_rate` stores sheet RATE).
 * - Cash: if `aed_amount` is missing, `units × unit_rate × 100`.
 * Agent-AED metal still uses booked AED only.
 */
export function saleTableDisplayAed(s: ICSale): number {
  const booked = dealSaleAed(s);
  if (Math.abs(Number(booked) || 0) >= 0.005) return booked;

  if (s.settlementMode === 'metal' && !isMetalAedPayment(s.metalPaymentMethod)) {
    const netInr = netMetalInr(Number(s.inrTotal) || 0, Number(s.labTotalInr) || 0);
    const rate = Number(s.unitRate) || 0;
    if (netInr > 0 && rate > 0) return computeMetalAedFromInr(netInr, rate);
  }

  if (s.settlementMode === 'cash') {
    const units = Number(s.units) || 0;
    const rate = Number(s.unitRate) || 0;
    if (units > 0 && rate > 0) return computeIcCashAedTotal(units, rate);
  }

  return 0;
}

export function formatDealTableAed(amount: number): React.ReactNode {
  if (Math.abs(Number(amount) || 0) < 0.005) return '—';
  return React.createElement(CurrencyAmount, { currency: 'AED', amount });
}

/** Cash or metal sheet RATE (~36) — same basis as deal modals (AED = units × rate × 100 or metal INR × rate ÷ 1000). */
export function purchaseDealSheetRate(p: ICPurchase): number {
  const stored = Number(p.unitRate);
  if (stored > 0) return stored;
  if (p.settlementMode === 'cash') {
    const units = Number(p.units) || 0;
    const aed = purchaseDealAed(p);
    if (units > 0 && aed > 0) return computeIcCashRateFromTotals(units, aed);
    return 0;
  }
  const inr = Number(p.inrTotal) || 0;
  const aed = Number(p.aedTotal) || 0;
  if (inr > 0 && aed > 0) return computeMetalSheetRateAed(inr, aed);
  return 0;
}

export function saleDealSheetRate(s: ICSale): number {
  const stored = Number(s.unitRate);
  if (stored > 0) return stored;
  if (s.settlementMode === 'cash') {
    const units = Number(s.units) || 0;
    const aed = saleTableDisplayAed(s);
    if (units > 0 && aed > 0) return computeIcCashRateFromTotals(units, aed);
    return 0;
  }
  const inr = Number(s.inrTotal) || 0;
  const aed = Number(s.aedAmount) || 0;
  if (inr > 0 && aed > 0) return computeMetalSheetRateAed(inr, aed);
  return 0;
}

export function formatDealTableSheetRate(rate: number): React.ReactNode {
  if (!Number.isFinite(rate) || rate <= 0) return '—';
  return React.createElement(
    'span',
    { className: 'font-mono tabular-nums text-slate-700' },
    formatRateAmount(rate),
  );
}

type SplitPaidFields = {
  metalPaymentMethod?: string | null;
  splitInrPaid?: number | null;
  splitAedPaid?: number | null;
};

function splitPaidInrAmount(d: SplitPaidFields): number {
  if (!isMetalSplitPayment(d.metalPaymentMethod)) return 0;
  return Number(d.splitInrPaid) || 0;
}

function splitPaidAedAmount(d: SplitPaidFields): number {
  if (!isMetalSplitPayment(d.metalPaymentMethod)) return 0;
  return Number(d.splitAedPaid) || 0;
}

export function formatDealTableSplitPaidInr(d: SplitPaidFields): React.ReactNode {
  return formatDealTableInr(splitPaidInrAmount(d));
}

export function formatDealTableSplitPaidAed(d: SplitPaidFields): React.ReactNode {
  return formatDealTableAed(splitPaidAedAmount(d));
}

export function tableSplitPaidInr(d: SplitPaidFields): number {
  return splitPaidInrAmount(d);
}

export function tableSplitPaidAed(d: SplitPaidFields): number {
  return splitPaidAedAmount(d);
}

export function formatSaleLineProfit(line: SaleLineProfit | undefined): React.ReactNode {
  if (!line) return '—';
  const primaryAmount = Number.isFinite(line.amount) ? line.amount : 0;
  const hasPrimary = Math.abs(primaryAmount) >= 0.005;
  const hasSecondary =
    line.secondaryCurrency != null &&
    Number.isFinite(line.secondaryAmount) &&
    Math.abs(line.secondaryAmount ?? 0) >= 0.005;
  if (!hasPrimary && !hasSecondary) return '—';
  const amountNode =
    line.currency === 'AED' ? formatDealTableAed(primaryAmount) : formatDealTableInr(primaryAmount);
  const tone = primaryAmount < 0 ? 'text-red-600' : 'text-emerald-700';

  if (hasSecondary && line.secondaryCurrency && line.secondaryAmount != null) {
    const secNode =
      line.secondaryCurrency === 'AED'
        ? formatDealTableAed(line.secondaryAmount)
        : formatDealTableInr(line.secondaryAmount);
    return React.createElement(
      'div',
      { className: 'flex flex-col items-end leading-tight' },
      React.createElement('span', { className: `font-mono font-medium tabular-nums ${tone}` }, amountNode),
      React.createElement(
        'span',
        { className: 'font-mono text-[10px] tabular-nums text-slate-500' },
        line.secondaryCurrency === 'AED' ? React.createElement('span', null, 'FX ', secNode) : secNode,
      ),
    );
  }

  return React.createElement('span', { className: `font-mono font-medium tabular-nums ${tone}` }, amountNode);
}

/** Plain strings for titles / exports. */
export function formatDealTableInrPlain(amount: number): string {
  if (Math.abs(amount) < 0.005) return '—';
  return fmtLedgerInr(amount);
}

export function formatDealTableAedPlain(amount: number): string {
  if (Math.abs(Number(amount) || 0) < 0.005) return '—';
  return fmtLedgerAed(amount);
}

export function formatMatrixInr(value: number): React.ReactNode {
  if (Math.abs(value) < 0.005) return '—';
  return React.createElement(CurrencyAmount, { currency: 'INR', amount: value });
}

/** Metal P&L cell — INR only. */
export function formatMatrixMetalPl(_aed: number, inr: number): React.ReactNode {
  return formatMatrixInr(inr);
}
