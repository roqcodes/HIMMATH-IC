'use client';

import React from 'react';
import { formatAmount } from '@/lib/icTransfer/rateCalculations';
import InrAmountInWords from './InrAmountInWords';
import { icFormFieldInnerGap, icFormTotalsLabel } from './icTransferFormModalLayout';

type Props = {
  units: number;
  inrTotal: number;
  aedNetTotal: number;
  /** When false, omit the "Totals" caption (e.g. section heading already present). */
  showLabel?: boolean;
};

export default function ICSaleAmountCards({
  units,
  inrTotal,
  aedNetTotal,
  showLabel = true,
}: Props) {
  return (
    <div className={`flex flex-col ${icFormFieldInnerGap}`}>
      {showLabel ? <p className={icFormTotalsLabel}>Totals</p> : null}
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 sm:grid-cols-3">
        <div className="flex flex-col justify-center rounded-lg border border-slate-100 bg-white px-1.5 py-1.5 text-center shadow-sm">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Units</span>
          <span className="mt-0.5 font-mono text-xs font-bold text-slate-800 sm:text-sm">
            {formatAmount(units, 4)}
          </span>
        </div>
        <div className="flex flex-col justify-center rounded-lg border border-slate-100 bg-white px-1.5 py-1.5 text-center shadow-sm">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Amount (INR)</span>
          <span className="mt-0.5 font-mono text-xs font-bold text-slate-800 sm:text-sm">
            {formatAmount(inrTotal)}
          </span>
          <InrAmountInWords
            amount={inrTotal}
            className="mt-0.5 line-clamp-2 text-[9px] font-medium leading-tight text-slate-500"
          />
        </div>
        <div className="flex flex-col justify-center rounded-lg border border-slate-100 bg-white px-1.5 py-1.5 text-center shadow-sm">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Amount (AED)</span>
          <span className="mt-0.5 font-mono text-xs font-bold text-slate-800 sm:text-sm">
            {formatAmount(aedNetTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}
