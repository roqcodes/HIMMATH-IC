'use client';

import React, { useCallback } from 'react';
import AsicFormField from '@/components/asic/AsicFormField';
import { asicFormGrid, asicInput } from '@/components/asic/ui';
import {
  applyMetalFieldChange,
  METAL_AED_RATE_DIVISOR,
  type MetalSettlementFields,
} from '@/lib/icTransfer/metalSettlement';
import { formatAmount } from '@/lib/icTransfer/rateCalculations';
import InrAmountInWords from '@/components/ic-transfer/shared/InrAmountInWords';

export type MetalFieldKey =
  | 'weight'
  | 'rateInr'
  | 'sheetRateAed'
  | 'totalInr'
  | 'totalAed';

type Props = {
  value: MetalSettlementFields;
  onChange: (next: MetalSettlementFields) => void;
  disabled?: boolean;
  lockWeight?: boolean;
};

function parseNum(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export default function MetalSettlementFields({ value, onChange, disabled, lockWeight }: Props) {
  const apply = useCallback(
    (next: MetalSettlementFields) => {
      onChange(next);
    },
    [onChange],
  );

  const onField = (field: MetalFieldKey, raw: string) => {
    apply(applyMetalFieldChange(value, field, parseNum(raw)));
  };

  return (
    <div className="space-y-2">
      <div className={asicFormGrid}>
        <AsicFormField label="Weight (g)" colSpan={12}>
          <input
            className={asicInput}
            type="number"
            step="0.0001"
            disabled={disabled || lockWeight}
            value={value.metalWeightG || ''}
            onChange={e => onField('weight', e.target.value)}
          />
        </AsicFormField>
        <AsicFormField label="G rate (INR)" colSpan={6}>
          <input
            className={asicInput}
            type="number"
            step="0.0001"
            disabled={disabled}
            value={value.metalRateInrPerG || ''}
            onChange={e => onField('rateInr', e.target.value)}
          />
        </AsicFormField>
        <AsicFormField label="Total (INR)" colSpan={6}>
          <input
            className={asicInput}
            type="number"
            step="0.01"
            disabled={disabled}
            value={value.inrTotal || ''}
            onChange={e => onField('totalInr', e.target.value)}
          />
        </AsicFormField>
        <AsicFormField
          label="Rate (AED)"
          colSpan={6}
          hint={`AED = INR × rate ÷ ${METAL_AED_RATE_DIVISOR.toLocaleString()}`}
        >
          <input
            className={asicInput}
            type="number"
            step="0.0001"
            disabled={disabled}
            value={value.metalSheetRateAed || ''}
            onChange={e => onField('sheetRateAed', e.target.value)}
          />
        </AsicFormField>
        <AsicFormField label="Total (AED)" colSpan={6}>
          <input
            className={asicInput}
            type="number"
            step="0.01"
            disabled={disabled}
            value={value.aedTotal || ''}
            onChange={e => onField('totalAed', e.target.value)}
          />
        </AsicFormField>
      </div>

      <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-100 bg-slate-50/50 p-2 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-100 bg-white px-1.5 py-1.5 text-center shadow-sm">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Metal</span>
          <p className="mt-0.5 font-mono text-xs font-bold text-slate-800 sm:text-sm">
            {formatAmount(value.metalWeightG, 4)} g
          </p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white px-1.5 py-1.5 text-center shadow-sm">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Amount (INR)</span>
          <p className="mt-0.5 font-mono text-xs font-bold text-slate-800 sm:text-sm">{formatAmount(value.inrTotal)}</p>
          <InrAmountInWords
            amount={value.inrTotal}
            className="mt-0.5 line-clamp-2 text-[9px] font-medium leading-tight text-slate-500"
          />
        </div>
        <div className="rounded-lg border border-slate-100 bg-white px-1.5 py-1.5 text-center shadow-sm">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Amount (AED)</span>
          <p className="mt-0.5 font-mono text-xs font-bold text-slate-800 sm:text-sm">{formatAmount(value.aedTotal)}</p>
        </div>
      </div>
    </div>
  );
}

export const emptyMetalFields = (): MetalSettlementFields => ({
  metalWeightG: 0,
  metalRateInrPerG: 0,
  metalSheetRateAed: 0,
  metalRateAedPerG: 0,
  inrTotal: 0,
  aedTotal: 0,
});
