'use client';

import React, { useCallback } from 'react';
import AsicFormField from '@/components/asic/AsicFormField';
import { asicFormGrid, asicInput } from '@/components/asic/ui';
import {
  applyLabFieldChange,
  type LabTestFields,
  type LabTestFieldKey,
} from '@/lib/icTransfer/labTest';

import {
  icPurchaseDenseInput,
  icPurchaseDenseLabel,
} from './icTransferFormModalLayout';

type Props = {
  value: LabTestFields;
  onChange: (next: LabTestFields) => void;
  metalGrossInr: number;
  disabled?: boolean;
  /** Dense purchase modal card layout. */
  compact?: boolean;
};

function parseNum(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export default function LabTestFields({ value, onChange, disabled, compact = false }: Props) {
  const apply = useCallback(
    (next: LabTestFields) => {
      onChange(next);
    },
    [onChange],
  );

  const onField = (field: LabTestFieldKey, raw: string) => {
    apply(applyLabFieldChange(value, field, parseNum(raw)));
  };

  const labelClass = compact ? icPurchaseDenseLabel : undefined;
  const fieldInput = compact ? `${asicInput} ${icPurchaseDenseInput}` : asicInput;
  const gridClass = compact
    ? 'grid grid-cols-1 gap-3 sm:grid-cols-3'
    : asicFormGrid;

  if (compact) {
    return (
      <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-3">
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Lab test (INR)</p>
        </div>
        <div className={gridClass}>
          <AsicFormField label="Weight (g)" labelClassName={labelClass}>
            <input
              className={fieldInput}
              type="number"
              step="0.0001"
              disabled={disabled}
              value={value.labWeightG || ''}
              onChange={e => onField('weight', e.target.value)}
            />
          </AsicFormField>
          <AsicFormField label="Charge (INR/g)" labelClassName={labelClass}>
            <input
              className={fieldInput}
              type="number"
              step="0.0001"
              disabled={disabled}
              value={value.labChargeInrPerG || ''}
              onChange={e => onField('charge', e.target.value)}
            />
          </AsicFormField>
          <AsicFormField label="Total (INR)" labelClassName={labelClass}>
            <input
              className={fieldInput}
              type="number"
              step="0.01"
              disabled={disabled}
              value={value.labTotalInr || ''}
              onChange={e => onField('total', e.target.value)}
            />
          </AsicFormField>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-2 dark:border-[var(--theme-border)]">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Lab test (INR)</p>
      <div className={asicFormGrid}>
        <AsicFormField label="Weight (g)" colSpan={4}>
          <input
            className={asicInput}
            type="number"
            step="0.0001"
            disabled={disabled}
            value={value.labWeightG || ''}
            onChange={e => onField('weight', e.target.value)}
          />
        </AsicFormField>
        <AsicFormField label="Charge (INR/g)" colSpan={4}>
          <input
            className={asicInput}
            type="number"
            step="0.0001"
            disabled={disabled}
            value={value.labChargeInrPerG || ''}
            onChange={e => onField('charge', e.target.value)}
          />
        </AsicFormField>
        <AsicFormField label="Total (INR)" colSpan={4}>
          <input
            className={asicInput}
            type="number"
            step="0.01"
            disabled={disabled}
            value={value.labTotalInr || ''}
            onChange={e => onField('total', e.target.value)}
          />
        </AsicFormField>
      </div>
    </div>
  );
}

export { emptyLabFields } from '@/lib/icTransfer/labTest';
