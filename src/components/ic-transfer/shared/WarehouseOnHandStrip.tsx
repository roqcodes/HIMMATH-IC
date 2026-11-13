'use client';

import React from 'react';
import { FmtLedgerInr } from '@/lib/icFunds/format';
import { formatMetalGrams } from '@/lib/icTransfer/warehouseMatrixMetrics';

type Props = {
  inrAmount: number;
  metalG: number;
  refreshing?: boolean;
};

export default function WarehouseOnHandStrip({ inrAmount, metalG, refreshing }: Props) {
  return (
    <div
      className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-white text-[11px]"
      role="group"
      aria-label="Warehouse on hand"
    >
      <div className="border-r border-slate-200 px-2.5 py-1.5">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
          Available INR
        </div>
        <div className="mt-0.5 font-mono font-semibold tabular-nums text-slate-900">
          <FmtLedgerInr amount={inrAmount} />
        </div>
      </div>
      <div className="px-2.5 py-1.5">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
          Available metal
        </div>
        <div className="mt-0.5 font-mono font-semibold tabular-nums text-slate-900">
          {formatMetalGrams(metalG)}
          {refreshing ? <span className="ml-1 text-[10px] font-normal text-slate-400">…</span> : null}
        </div>
      </div>
    </div>
  );
}
