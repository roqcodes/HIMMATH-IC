'use client';

import React from 'react';
import type { ICRateGroup } from '@/types';
import { formatAmount, formatRateAmount, getCurrencyUnitRate } from '@/lib/icTransfer/rateCalculations';

type Props = {
  group: ICRateGroup;
  /** When set, shows this label instead of the rate group name (e.g. branch name for customer portal). */
  displayName?: string;
  /** Branch portal: show rate values only — no group name or internal labels. */
  ratesOnly?: boolean;
  /** Customer portal: hide AED sale rate — show destination currency rate only. */
  hideAedRate?: boolean;
};

export default function RateGroupBanner({ group, displayName, ratesOnly = false, hideAedRate = false }: Props) {
  const currencyUnitRate = getCurrencyUnitRate(group.saleRate, group.conversionRate || 1);
  const groupCurrency = group.currency?.toUpperCase();
  const showConversion = Boolean(groupCurrency && groupCurrency !== 'AED' && groupCurrency !== 'CURRENCY');

  if (ratesOnly) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {!hideAedRate ? (
          <span>
            <span className="font-semibold text-slate-400 uppercase">AED</span>{' '}
            <span className="font-bold tabular-nums text-accent">{formatAmount(group.saleRate)}</span>
          </span>
        ) : null}
        <span>
          <span className="font-semibold text-slate-400 uppercase">{group.currency}</span>{' '}
          <span className="font-bold tabular-nums text-indigo-600">{formatAmount(currencyUnitRate)}</span>
        </span>
        {showConversion ? (
          <span>
            <span className="font-semibold text-slate-400 uppercase">Conv</span>{' '}
            <span className="font-bold tabular-nums text-slate-700">
              {formatRateAmount(group.conversionRate || 1)}
            </span>
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs">
      <span className="font-semibold text-slate-500 uppercase tracking-wider">
        {displayName ? (
          <strong className="text-slate-700 normal-case">{displayName}</strong>
        ) : (
          <>
            Applicable Rate Group: <strong className="text-slate-700">{group.name}</strong>
          </>
        )}
      </span>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {!hideAedRate ? (
          <span>
            <span className="font-semibold text-slate-400 uppercase">Sale Rate (AED):</span>{' '}
            <span className="font-bold text-accent">{formatAmount(group.saleRate)}</span>
          </span>
        ) : null}
        <span>
          <span className="font-semibold text-slate-400 uppercase">Rate ({group.currency}):</span>{' '}
          <span className="font-bold text-indigo-600">{formatAmount(currencyUnitRate)}</span>
        </span>
        {showConversion ? (
          <span>
            <span className="font-semibold text-slate-400 uppercase">
              Conversion (AED → {group.currency}):
            </span>{' '}
            <span className="font-bold tabular-nums text-slate-800">
              {formatRateAmount(group.conversionRate || 1)}
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
