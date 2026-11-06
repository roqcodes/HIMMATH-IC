import React from 'react';
import CurrencyAmount from '@/components/currency/CurrencyAmount';
import { fmtLedgerAed, fmtLedgerInr } from '@/lib/icFunds/format';
import { isMetalAedPayment } from '@/lib/domain/books';
import { dealPurchaseAed, dealSaleAed } from '@/lib/icTransfer/dealBookKpis';
import { netMetalInr } from '@/lib/icTransfer/labTest';
import { computeMetalAedFromInr, resolvePurchaseInrDisplay, resolveSaleInrDisplay } from '@/lib/icTransfer/metalSettlement';
import { computeIcCashAedTotal } from '@/lib/icTransfer/rateCalculations';
import type { ICPurchase, ICSale } from '@/types';

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
 * - Cash: if `aed_amount` is missing, `units × unit_rate`.
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
