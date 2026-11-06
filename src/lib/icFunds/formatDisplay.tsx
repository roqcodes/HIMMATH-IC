import React from 'react';
import CurrencyAmount from '@/components/currency/CurrencyAmount';

/** React nodes for KPI / metric values (plain strings stay in hints via fmtLedger* in format.ts). */
export function ledgerAedNode(n: number, showPlus?: boolean): React.ReactNode {
  return React.createElement(CurrencyAmount, { currency: 'AED', amount: n, showPlus });
}

export function ledgerInrNode(n: number, showPlus?: boolean): React.ReactNode {
  return React.createElement(CurrencyAmount, { currency: 'INR', amount: n, showPlus });
}

export function ledgerAmountNode(n: number, book: 'AED' | 'INR' | undefined, showPlus?: boolean): React.ReactNode {
  return book === 'INR'
    ? ledgerInrNode(n, showPlus)
    : ledgerAedNode(n, showPlus);
}

export function signedLedgerAmountNode(currency: 'AED' | 'INR', n: number): React.ReactNode {
  if (Math.abs(n) < 0.005) {
    return ledgerAmountNode(0, currency);
  }
  const prefix = n > 0 ? 'Dr ' : 'Cr ';
  return (
    <>
      {prefix}
      <CurrencyAmount currency={currency} amount={Math.abs(n)} />
    </>
  );
}
