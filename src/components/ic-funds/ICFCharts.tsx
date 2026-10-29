'use client';

import React from 'react';
import { fmtLedgerAed } from '@/lib/icFunds/format';
import { icfCard, icfLabel } from '@/components/ic-funds/ui';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';

type TrendPoint = { label: string; debit: number; credit: number };

export function ICFKpiGrid({ items }: { items: Array<{ label: string; value: string; hint?: string }> }) {
  return (
    <div className={`relative isolate z-0 ${icfCard} grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-4`}>
      {items.map(item => (
        <div key={item.label} className="min-w-0 overflow-hidden bg-white px-3 py-2.5">
          <p className={`${icfLabel} truncate`} title={item.label}>
            {item.label}
          </p>
          <p
            className="mt-0.5 truncate font-mono text-base font-semibold tabular-nums text-slate-900"
            title={item.value}
          >
            {item.value}
          </p>
          {item.hint ? (
            <p
              className="mt-0.5 line-clamp-2 break-words text-[10px] leading-snug text-slate-400"
              title={item.hint}
            >
              {item.hint}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function ICFTrendChart({
  data,
  title,
  debitLabel = 'In / Debit',
  creditLabel = 'Out / Credit',
}: {
  data: TrendPoint[];
  title: string;
  debitLabel?: string;
  creditLabel?: string;
}) {
  const maxVal = Math.max(...data.flatMap(d => [d.debit, d.credit]), 1);

  return (
    <div className={icfCard}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <div className="flex flex-wrap gap-3 text-[10px] font-medium text-slate-500">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-slate-900" />
            {debitLabel}
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-emerald-500" />
            {creditLabel}
          </span>
        </div>
      </div>
      <div className="flex h-36 items-stretch gap-1.5 px-3 pb-3 pt-3">
        {data.length === 0 ? (
          <p className="flex h-full w-full items-center justify-center text-sm text-slate-400">No activity yet</p>
        ) : (
          data.map((d, i) => (
            <div key={i} className="flex min-w-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 items-end justify-center gap-px">
                <div
                  className="w-1/2 max-w-[18px] rounded-t-sm bg-slate-900/90 transition-opacity group-hover:opacity-80"
                  style={{ height: `${Math.max((d.debit / maxVal) * 100, 2)}%` }}
                  title={`${debitLabel}: ${fmtLedgerAed(d.debit)}`}
                />
                <div
                  className="w-1/2 max-w-[18px] rounded-t-sm bg-emerald-500 transition-opacity group-hover:opacity-80"
                  style={{ height: `${Math.max((d.credit / maxVal) * 100, 2)}%` }}
                  title={`${creditLabel}: ${fmtLedgerAed(d.credit)}`}
                />
              </div>
              <span
                className="mt-1.5 truncate text-center text-[10px] text-slate-400"
                title={d.label}
              >
                {d.label}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type SinglePoint = { label: string; value: number };

export function ICFBarChart({
  data,
  title,
  formatValue = fmtLedgerAed,
}: {
  data: SinglePoint[];
  title: string;
  formatValue?: (n: number) => string;
}) {
  const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 1);

  return (
    <div className={icfCard}>
      <p className="border-b border-slate-200 px-3 py-2 text-sm font-medium text-slate-900">{title}</p>
      <div className="flex h-36 items-stretch gap-2 px-3 pb-3 pt-3">
        {data.every(d => d.value === 0) ? (
          <p className="flex h-full w-full items-center justify-center text-sm text-slate-400">No activity yet</p>
        ) : (
          data.map((d, i) => (
            <div key={i} className="flex min-w-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 items-end justify-center">
                <div
                  className="w-full max-w-[28px] rounded-t-sm bg-slate-700 transition-opacity group-hover:opacity-80"
                  style={{ height: `${Math.max((Math.abs(d.value) / maxVal) * 100, 2)}%` }}
                  title={`${d.label}: ${formatValue(d.value)}`}
                />
              </div>
              <span
                className="mt-1.5 truncate text-center text-[10px] text-slate-400"
                title={d.label}
              >
                {d.label}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function ICFRankingList({
  title,
  data,
  slug,
}: {
  title: string;
  data: Array<{ name: string; accountId?: string; amount: number; percentage: number }>;
  slug?: string;
}) {
  return (
    <div className={icfCard}>
      <p className="border-b border-slate-200 px-3 py-2 text-sm font-medium text-slate-900">{title}</p>
      <div className="flex flex-col gap-3 px-3 py-3">
        {data.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No counterparty activity</p>
        ) : (
          data.map((d, i) => (
            <div key={d.accountId ?? i} className="flex flex-col gap-1">
              <div className="flex items-end justify-between gap-2 text-xs font-medium text-slate-700">
                <span className="truncate">
                  {slug && d.accountId ? (
                    <ICFundAccountLink slug={slug} accountId={d.accountId} name={d.name} />
                  ) : (
                    d.name
                  )}
                </span>
                <span className="shrink-0 font-mono tabular-nums">{fmtLedgerAed(d.amount)}</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-slate-800" style={{ width: `${Math.max(d.percentage, 2)}%` }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
