'use client';

import React from 'react';
import type { ICRateGroup } from '@/types';
import { formatAmount } from '@/lib/icTransfer/rateCalculations';

type Props = {
  group: ICRateGroup;
  /** When set, shows this label instead of the rate group name (e.g. branch name for customer portal). */
  displayName?: string;
  /** Branch portal: show rate values only — no group name or internal labels. */
  ratesOnly?: boolean;
  /** Customer portal: hide AED sale rate — show destination currency rate only. */
  hideAedRate?: boolean;
};

export default function RateGroupBanner({
  group,
  displayName,
  ratesOnly = false,
  hideAedRate = false,
}: Props) {
  if (ratesOnly) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs">
        {!hideAedRate ? (
          <span>
            <span className="font-semibold uppercase text-slate-400">Rate</span>{' '}
            <span className="font-bold tabular-nums text-accent">{formatAmount(group.saleRate)}</span>
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
      <span className="font-semibold uppercase tracking-wider text-slate-500">
        {displayName ? (
          <strong className="normal-case text-slate-700">{displayName}</strong>
        ) : (
          <>
            Applicable Rate Group: <strong className="text-slate-700">{group.name}</strong>
          </>
        )}
      </span>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {!hideAedRate ? (
          <span>
            <span className="font-semibold uppercase text-slate-400">Sale Rate (AED):</span>{' '}
            <span className="font-bold text-accent">{formatAmount(group.saleRate)}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
