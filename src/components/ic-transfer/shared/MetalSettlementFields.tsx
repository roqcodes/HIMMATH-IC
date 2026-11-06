'use client';

import React, { useCallback } from 'react';
import AsicFormField from '@/components/asic/AsicFormField';
import { asicInput } from '@/components/asic/ui';
import {
  icFormGrid,
  icFormFieldStack,
  icFormStackGap,
  icPurchaseDenseInput,
  icPurchaseDenseLabel,
  icPurchaseReadOnlyInput,
} from './icTransferFormModalLayout';
import {
  applyMetalFieldChange,
  METAL_AMOUNT_DECIMALS,
  METAL_WEIGHT_DECIMALS,
  type MetalSettlementFields,
} from '@/lib/icTransfer/metalSettlement';
import { formatAmount } from '@/lib/icTransfer/rateCalculations';
import FormattedNumberInput from '@/components/ic-transfer/shared/FormattedNumberInput';
import InrAmountInWords from '@/components/ic-transfer/shared/InrAmountInWords';
import { SmoothCollapse } from '@/components/ui/SmoothHeight';
import { netMetalInr } from '@/lib/icTransfer/labTest';
import { fmtLedgerInr, FmtLedgerInr, FmtLedgerAed } from '@/lib/icFunds/format';

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
  showAedFields?: boolean;
  /** When true, AED inputs stay visible (no collapse) — e.g. metal sales always need unit rate. */
  pinAedFields?: boolean;
  /** Rendered directly under weight (e.g. Cash / AED payment type). */
  afterWeight?: React.ReactNode;
  /** Rendered immediately above the Metal / Amount summary cards. */
  beforeTotals?: React.ReactNode;
  /** Lab deduction — Amount (INR) card shows net payable/receivable. */
  labTotalInr?: number;
  /** Purchase modal: tighter labels, optional read-only totals, hide built-in KPI row. */
  dense?: boolean;
  hideSummaryCards?: boolean;
  readOnlyTotals?: boolean;
};

export default function MetalSettlementFields({
  value,
  onChange,
  disabled,
  lockWeight,
  showAedFields = true,
  pinAedFields = false,
  afterWeight,
  beforeTotals,
  labTotalInr = 0,
  dense = false,
  hideSummaryCards = false,
  readOnlyTotals = false,
}: Props) {
  const apply = useCallback(
    (next: MetalSettlementFields) => {
      onChange(next);
    },
    [onChange],
  );

  const onField = (field: MetalFieldKey, n: number) => {
    apply(applyMetalFieldChange(value, field, n));
  };

  const unitMode = value.aedRateMode === 'unit';
  const lab = Number(labTotalInr) || 0;
  const netInr = netMetalInr(value.inrTotal, lab);
  const showLabNet = lab > 0;
  const labelClass = dense ? icPurchaseDenseLabel : undefined;
  const fieldInput = dense ? `${asicInput} ${icPurchaseDenseInput}` : asicInput;
  const computedInput = dense ? `${fieldInput} ${icPurchaseReadOnlyInput}` : fieldInput;
  const metalGridClass = dense
    ? 'grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-12 lg:items-start [&>*]:min-w-0 lg:[&>*:not([class*="col-span"])]:col-span-4'
    : icFormGrid;

  const weightRow = (
    <>
      <AsicFormField label="Weight (g)" colSpan={dense ? 4 : 12} labelClassName={labelClass}>
        <FormattedNumberInput
          className={fieldInput}
          book="inr"
          maxFractionDigits={METAL_WEIGHT_DECIMALS}
          disabled={disabled || lockWeight}
          value={value.metalWeightG}
          onNumericChange={n => onField('weight', n)}
        />
      </AsicFormField>
      {afterWeight ? (
        <div className={dense ? 'min-w-0 lg:col-span-8' : `col-span-12 ${icFormFieldStack}`}>{afterWeight}</div>
      ) : null}
    </>
  );

  return (
    <div className={icFormFieldStack}>
      <div className={metalGridClass}>
        {dense ? (
          <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2 lg:col-span-12 lg:grid-cols-12 lg:items-end">
            {weightRow}
          </div>
        ) : (
          weightRow
        )}
        <AsicFormField label="G rate (INR)" colSpan={dense ? 4 : 6} labelClassName={labelClass}>
          <FormattedNumberInput
            className={fieldInput}
            book="inr"
            maxFractionDigits={METAL_AMOUNT_DECIMALS}
            disabled={disabled}
            value={value.metalRateInrPerG}
            onNumericChange={n => onField('rateInr', n)}
          />
        </AsicFormField>
        <AsicFormField label="Total (INR)" colSpan={dense ? 4 : 6} labelClassName={labelClass}>
          <FormattedNumberInput
            className={readOnlyTotals ? computedInput : fieldInput}
            book="inr"
            maxFractionDigits={METAL_AMOUNT_DECIMALS}
            disabled={disabled}
            readOnly={readOnlyTotals}
            value={value.inrTotal}
            onNumericChange={n => onField('totalInr', n)}
          />
        </AsicFormField>
        {showAedFields ? (
          pinAedFields ? (
            <>
              <AsicFormField
                label={unitMode ? 'Unit rate (AED)' : 'Rate (AED)'}
                colSpan={dense ? 4 : 6}
                labelClassName={labelClass}
              >
                <FormattedNumberInput
                  className={fieldInput}
                  book="aed"
                  maxFractionDigits={METAL_AMOUNT_DECIMALS}
                  disabled={disabled}
                  value={value.metalSheetRateAed}
                  onNumericChange={n => onField('sheetRateAed', n)}
                />
              </AsicFormField>
              <AsicFormField label="Total (AED)" colSpan={dense ? 4 : 6} labelClassName={labelClass}>
                <FormattedNumberInput
                  className={readOnlyTotals ? computedInput : fieldInput}
                  book="aed"
                  maxFractionDigits={METAL_AMOUNT_DECIMALS}
                  disabled={disabled}
                  readOnly={readOnlyTotals}
                  value={value.aedTotal}
                  onNumericChange={n => onField('totalAed', n)}
                />
              </AsicFormField>
            </>
          ) : (
            <SmoothCollapse open className="col-span-12">
              <div className={icFormGrid}>
                <AsicFormField
                  label={unitMode ? 'Unit rate (AED)' : 'Rate (AED)'}
                  colSpan={dense ? 4 : 6}
                  labelClassName={labelClass}
                >
                  <FormattedNumberInput
                    className={fieldInput}
                    book="aed"
                    maxFractionDigits={METAL_AMOUNT_DECIMALS}
                    disabled={disabled}
                    value={value.metalSheetRateAed}
                    onNumericChange={n => onField('sheetRateAed', n)}
                  />
                </AsicFormField>
                <AsicFormField label="Total (AED)" colSpan={dense ? 4 : 6} labelClassName={labelClass}>
                  <FormattedNumberInput
                    className={readOnlyTotals ? computedInput : fieldInput}
                    book="aed"
                    maxFractionDigits={METAL_AMOUNT_DECIMALS}
                    disabled={disabled}
                    readOnly={readOnlyTotals}
                    value={value.aedTotal}
                    onNumericChange={n => onField('totalAed', n)}
                  />
                </AsicFormField>
              </div>
            </SmoothCollapse>
          )
        ) : null}
      </div>

      {beforeTotals ? <div>{beforeTotals}</div> : null}

      {!hideSummaryCards ? (
      <div
        className={`grid grid-cols-1 ${icFormStackGap} rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 ${showAedFields ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
      >
        <div className="rounded-lg border border-slate-100 bg-white px-1.5 py-1.5 text-center shadow-sm">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Metal</span>
          <p className="mt-0.5 font-mono text-xs font-bold text-slate-800 sm:text-sm">
            {formatAmount(value.metalWeightG, 4)} g
          </p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white px-1.5 py-1.5 text-center shadow-sm">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
            {showLabNet ? 'Net (INR)' : 'Amount (INR)'}
          </span>
          <p className="mt-0.5 font-mono text-xs font-bold text-slate-800 sm:text-sm">
            <FmtLedgerInr amount={netInr} zeroDisplay={null} />
          </p>
          {showLabNet ? (
            <p className="mt-0.5 text-[9px] font-medium leading-tight text-slate-500">
              Gross <FmtLedgerInr amount={value.inrTotal} /> − Lab <FmtLedgerInr amount={lab} />
            </p>
          ) : (
            <InrAmountInWords
              amount={netInr}
              className="mt-0.5 line-clamp-2 text-[9px] font-medium leading-tight text-slate-500"
            />
          )}
        </div>
        {showAedFields ? (
          <div className="rounded-lg border border-slate-100 bg-white px-1.5 py-1.5 text-center shadow-sm">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Amount (AED)</span>
            <p className="mt-0.5 font-mono text-xs font-bold text-slate-800 sm:text-sm">
              <FmtLedgerAed amount={value.aedTotal} zeroDisplay={null} />
            </p>
          </div>
        ) : null}
      </div>
      ) : null}
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
