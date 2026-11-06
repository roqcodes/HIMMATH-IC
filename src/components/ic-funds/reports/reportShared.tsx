'use client';

import React from 'react';
import { fmtLedgerAed, FmtLedgerAed, FmtLedgerInr } from '@/lib/icFunds/format';
import { icfLabel, icfTd } from '@/components/ic-funds/ui';

/** Short ledger caption for day book / trial balance headers (AED fund accounting). */
export const AED_LEDGER_CAPTION = 'Dirhams (AED).';

export function ReportSegmentTabs<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (id: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={icfLabel}>{label}</span>
      <div
        role="tablist"
        aria-label={label}
        className="inline-flex max-w-full flex-wrap gap-0.5 rounded-lg border border-[var(--theme-border-field)] bg-slate-50/90 p-0.5 dark:bg-[var(--theme-surface-muted)]"
      >
        {options.map(opt => {
          const active = opt.id === value;
          return (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(opt.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus-ring)] focus-visible:ring-offset-0 ${
                active
                  ? 'bg-white text-slate-900 shadow-surface-xs dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text)]'
                  : 'text-slate-500 hover:bg-slate-100/90 hover:text-slate-800 dark:text-[var(--theme-text-secondary)] dark:hover:bg-[var(--theme-surface-hover)] dark:hover:text-[var(--theme-text)]'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
