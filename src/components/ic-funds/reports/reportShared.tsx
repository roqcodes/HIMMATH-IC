'use client';

import React from 'react';
import { fmtLedgerAed, FmtLedgerAed, FmtLedgerInr } from '@/lib/icFunds/format';
import { icfTd } from '@/components/ic-funds/ui';

export const AED_LEDGER_CAPTION =
  'AED fund ledger. Metal in rupees is on Metal register / Statement (INR).';

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

export function ReportSegmentTabs<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<{ id: T; label: string }>;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-raised)]"
      role="tablist"
      aria-label={label}
    >
      {options.map(opt => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
              selected
                ? 'bg-slate-900 text-white dark:bg-[var(--theme-text-primary)]'
                : 'text-slate-600 hover:bg-slate-50 dark:text-[var(--theme-text-secondary)] dark:hover:bg-[var(--theme-surface-hover)]'
            }`}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function fmtDrCr(n: number): string {
  return n === 0 ? '—' : fmtLedgerAed(n);
}
