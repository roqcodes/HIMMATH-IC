'use client';

import React from 'react';
import { icfCard } from '@/components/ic-funds/ui';

export type AsicKpiMetric = {
  label: string;
  value: React.ReactNode;
  /** Plain-text tooltip for value (defaults to string values only). */
  valueTitle?: string;
  hint?: string;
  tone?: 'default' | 'amber' | 'emerald' | 'indigo' | 'slate' | 'red';
};

const toneClass: Record<NonNullable<AsicKpiMetric['tone']>, string> = {
  default: 'text-slate-900 dark:text-[var(--theme-text)]',
  amber: 'text-amber-700 dark:text-amber-400',
  emerald: 'text-emerald-700 dark:text-emerald-400',
  indigo: 'text-indigo-700 dark:text-indigo-400',
  slate: 'text-slate-700 dark:text-[var(--theme-text-secondary)]',
  red: 'text-red-700 dark:text-red-400',
};

function MetricCell({ label, value, valueTitle, hint, tone = 'default' }: AsicKpiMetric) {
  const valueTooltip = valueTitle ?? (typeof value === 'string' ? value : undefined);
  return (
    <div className="min-w-0 overflow-hidden px-3 py-2.5">
      <p
        className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-[var(--theme-text-muted)]"
        title={label}
      >
        {label}
      </p>
      <p
        className={`mt-0.5 truncate text-lg font-bold tabular-nums leading-none sm:text-xl ${toneClass[tone]}`}
        title={valueTooltip}
      >
        {value}
      </p>
    </div>
  );
}

export default function AsicKpiStrip({
  metrics,
  columns = 4,
  className = '',
}: {
  metrics: AsicKpiMetric[];
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}) {
  const colClass =
    columns === 6
      ? 'sm:grid-cols-3 lg:grid-cols-6'
      : columns === 5
        ? 'sm:grid-cols-3 lg:grid-cols-5'
        : columns === 3
          ? 'sm:grid-cols-3'
          : columns === 2
            ? 'sm:grid-cols-2'
            : 'sm:grid-cols-2 lg:grid-cols-4';

  return (
    <section
      className={`relative isolate z-0 mb-3 ${icfCard} ${className}`}
      aria-label="Summary metrics"
    >
      <div className={`grid grid-cols-2 divide-x divide-y divide-[var(--theme-border-subtle)] ${colClass}`}>
        {metrics.map(m => (
          <div key={m.label} className="min-w-0 bg-[var(--theme-surface)]">
            <MetricCell {...m} />
          </div>
        ))}
      </div>
    </section>
  );
}
