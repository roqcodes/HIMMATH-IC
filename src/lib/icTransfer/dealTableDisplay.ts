import React from 'react';
import CurrencyAmount from '@/components/currency/CurrencyAmount';
import { fmtLedgerAed, fmtLedgerInr } from '@/lib/icFunds/format';
import { dealPurchaseAed, dealSaleAed } from '@/lib/icTransfer/dealBookKpis';
import { resolvePurchaseInrDisplay, resolveSaleInrDisplay } from '@/lib/icTransfer/metalSettlement';
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
