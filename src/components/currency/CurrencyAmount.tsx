'use client';

import React from 'react';
export const AED_INDICATOR = '⃃';

const symbolClass = 'text-[0.72em] font-medium leading-none align-baseline opacity-90';

export type CurrencyAmountProps = {
  amount: number;
  currency: 'AED' | 'INR';
  showPlus?: boolean;
  className?: string;
  /** When set, render this instead of a formatted zero (e.g. em dash). */
  zeroDisplay?: React.ReactNode;
  /** Fraction digits for AED (default 2 max). INR uses en-IN with 2 max. */
  maxFractionDigits?: number;
};

function formatInrNumber(amount: number, showPlus: boolean): string {
  if (!Number.isFinite(amount)) return '0';
  const abs = Math.abs(amount);
  const numStr = abs.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const sign = amount < 0 ? '-' : showPlus && amount > 0 ? '+' : '';
  return `${sign}${numStr}`;
}

function formatAedNumber(amount: number, showPlus: boolean, maxFractionDigits: number): string {
  if (!Number.isFinite(amount)) return '0';
  const absAmount = Math.abs(amount);
  const numStr = absAmount.toLocaleString('en-US', {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: 0,
  });
  const sign = amount < 0 ? '-' : showPlus && amount > 0 ? '+' : '';
  return `${sign}${numStr}`;
}

export function fmtLedgerAedPlain(n: number, showPlus = false): string {
  if (!Number.isFinite(n)) return `${AED_INDICATOR}0`;
  return `${AED_INDICATOR}${formatAedNumber(n, showPlus, 2)}`;
}

export function fmtLedgerInrPlain(n: number, showPlus = false): string {
  if (!Number.isFinite(n)) return '₹0';
  return `₹${formatInrNumber(n, showPlus)}`;
}

export function fmtLedgerAmountPlain(n: number, book: 'AED' | 'INR' | undefined, showPlus = false): string {
  return book === 'INR' ? fmtLedgerInrPlain(n, showPlus) : fmtLedgerAedPlain(n, showPlus);
}

export default function CurrencyAmount({
  amount,
  currency,
  showPlus = false,
  className = '',
  zeroDisplay,
  maxFractionDigits = 2,
}: CurrencyAmountProps) {
  const isZero = !Number.isFinite(amount) || Math.abs(amount) < 0.005;
  if (isZero && zeroDisplay !== undefined) {
    return <span className={className}>{zeroDisplay}</span>;
  }

  const symbol = currency === 'INR' ? '₹' : AED_INDICATOR;
  const numStr =
    currency === 'INR'
      ? formatInrNumber(amount, showPlus)
      : formatAedNumber(amount, showPlus, maxFractionDigits);

  return (
    <span className={`inline-flex items-baseline gap-0.5 tabular-nums ${className}`.trim()}>
      <span className={symbolClass} aria-hidden>
        {symbol}
      </span>
      <span>{numStr}</span>
    </span>
  );
}

export function FmtLedgerAed({
  amount,
  showPlus,
  className,
  zeroDisplay = '—',
}: Omit<CurrencyAmountProps, 'currency'> & { amount: number }) {
  const isZero = Math.abs(amount) < 0.005;
  if (isZero && zeroDisplay !== undefined) {
    return <>{zeroDisplay}</>;
  }
  return (
    <CurrencyAmount amount={amount} currency="AED" showPlus={showPlus} className={className} zeroDisplay={zeroDisplay} />
  );
}

export function FmtLedgerInr({
  amount,
  showPlus,
  className,
  zeroDisplay = '—',
}: Omit<CurrencyAmountProps, 'currency'> & { amount: number }) {
  const isZero = Math.abs(amount) < 0.005;
  if (isZero && zeroDisplay !== undefined) {
    return <>{zeroDisplay}</>;
  }
  return (
    <CurrencyAmount amount={amount} currency="INR" showPlus={showPlus} className={className} zeroDisplay={zeroDisplay} />
  );
}

export function FmtLedgerAmount({
  amount,
  book,
  showPlus,
  className,
  zeroDisplay = '—',
}: {
  amount: number;
  book: 'AED' | 'INR' | undefined;
  showPlus?: boolean;
  className?: string;
  zeroDisplay?: React.ReactNode;
}) {
  return book === 'INR' ? (
    <FmtLedgerInr amount={amount} showPlus={showPlus} className={className} zeroDisplay={zeroDisplay} />
  ) : (
    <FmtLedgerAed amount={amount} showPlus={showPlus} className={className} zeroDisplay={zeroDisplay} />
  );
}
