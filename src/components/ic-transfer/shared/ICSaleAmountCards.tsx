'use client';

import React from 'react';
import { formatAmount } from '@/lib/icTransfer/rateCalculations';
import InrAmountInWords from './InrAmountInWords';

type Props = {
  units: number;
  inrTotal: number;
  aedNetTotal: number;
};

export default function ICSaleAmountCards({ units, inrTotal, aedNetTotal }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:grid-cols-3">
      <div className="flex flex-col justify-center rounded-xl border border-slate-100 bg-white p-3 text-center shadow-sm">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Units</span>
        <span className="mt-1.5 font-mono text-base font-bold text-slate-800 sm:text-lg">
          {formatAmount(units, 4)}
        </span>
      </div>
      <div className="flex flex-col justify-center rounded-xl border border-slate-100 bg-white p-3 text-center shadow-sm">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount (INR)</span>
        <span className="mt-1.5 font-mono text-base font-bold text-slate-800 sm:text-lg">
          {formatAmount(inrTotal)}
        </span>
        <InrAmountInWords amount={inrTotal} />
      </div>
      <div className="flex flex-col justify-center rounded-xl border border-slate-100 bg-white p-3 text-center shadow-sm">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount (AED)</span>
        <span className="mt-1.5 font-mono text-base font-bold text-slate-800 sm:text-lg">
          {formatAmount(aedNetTotal)}
        </span>
      </div>
    </div>
  );
}
