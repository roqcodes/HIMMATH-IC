'use client';

import React, { useCallback } from 'react';
import AsicFormField from '@/components/asic/AsicFormField';
import { asicFormGrid, asicInput } from '@/components/asic/ui';
import {
  applyLabFieldChange,
  type LabTestFields,
  type LabTestFieldKey,
} from '@/lib/icTransfer/labTest';
import { METAL_AMOUNT_DECIMALS, METAL_WEIGHT_DECIMALS } from '@/lib/icTransfer/metalSettlement';

import {
  icPurchaseDenseInput,
  icPurchaseDenseLabel,
} from './icTransferFormModalLayout';
import FormattedNumberInput from './FormattedNumberInput';

type Props = {
  value: LabTestFields;
  onChange: (next: LabTestFields) => void;
  metalGrossInr: number;
  disabled?: boolean;
  /** Dense purchase modal card layout. */
  compact?: boolean;
};

export default function LabTestFields({ value, onChange, disabled, compact = false }: Props) {
  const apply = useCallback(
    (next: LabTestFields) => {
      onChange(next);
    },
    [onChange],
  );

  const onField = (field: LabTestFieldKey, n: number) => {
    apply(applyLabFieldChange(value, field, n));
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
            <FormattedNumberInput
              className={fieldInput}
              book="inr"
              maxFractionDigits={METAL_WEIGHT_DECIMALS}
              disabled={disabled}
              value={value.labWeightG}
              onNumericChange={n => onField('weight', n)}
            />
          </AsicFormField>
          <AsicFormField label="Charge (INR/g)" labelClassName={labelClass}>
            <FormattedNumberInput
              className={fieldInput}
              book="inr"
              maxFractionDigits={METAL_AMOUNT_DECIMALS}
              disabled={disabled}
              value={value.labChargeInrPerG}
              onNumericChange={n => onField('charge', n)}
            />
          </AsicFormField>
          <AsicFormField label="Total (INR)" labelClassName={labelClass}>
            <FormattedNumberInput
              className={fieldInput}
              book="inr"
              maxFractionDigits={METAL_AMOUNT_DECIMALS}
              disabled={disabled}
              value={value.labTotalInr}
              onNumericChange={n => onField('total', n)}
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
          <FormattedNumberInput
            className={asicInput}
            book="inr"
            maxFractionDigits={METAL_WEIGHT_DECIMALS}
            disabled={disabled}
            value={value.labWeightG}
            onNumericChange={n => onField('weight', n)}
          />
        </AsicFormField>
        <AsicFormField label="Charge (INR/g)" colSpan={4}>
          <FormattedNumberInput
            className={asicInput}
            book="inr"
            maxFractionDigits={METAL_AMOUNT_DECIMALS}
            disabled={disabled}
            value={value.labChargeInrPerG}
            onNumericChange={n => onField('charge', n)}
          />
        </AsicFormField>
        <AsicFormField label="Total (INR)" colSpan={4}>
          <FormattedNumberInput
            className={asicInput}
            book="inr"
            maxFractionDigits={METAL_AMOUNT_DECIMALS}
            disabled={disabled}
            value={value.labTotalInr}
            onNumericChange={n => onField('total', n)}
          />
        </AsicFormField>
      </div>
    </div>
  );
}

export { emptyLabFields } from '@/lib/icTransfer/labTest';
