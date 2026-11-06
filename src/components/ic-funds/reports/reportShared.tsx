'use client';

import React from 'react';
import { fmtLedgerAed, FmtLedgerAed, FmtLedgerInr } from '@/lib/icFunds/format';
import { icfTd } from '@/components/ic-funds/ui';

export function ReportAmountCell({
  n,
  danger,
  currency = 'AED',
}: {
  n: number;
  danger?: boolean;
  currency?: 'AED' | 'INR';
}) {
  return (
    <td className={`${icfTd} text-right font-mono tabular-nums ${danger || n < 0 ? 'text-red-600' : ''}`}>
      {currency === 'INR' ? <FmtLedgerInr amount={n} /> : <FmtLedgerAed amount={n} />}
    </td>
  );
}

export function ReportCaption({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-b border-slate-200 px-2.5 py-1 text-[11px] text-slate-500 dark:border-[var(--theme-border)] dark:text-[var(--theme-text-secondary)]">
      {children}
    </p>
  );
}

export function fmtDrCr(n: number): string {
  return n === 0 ? '—' : fmtLedgerAed(n);
}
