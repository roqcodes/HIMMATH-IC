'use client';

import React from 'react';
import ICTransferFormField from '@/components/ic-transfer/shared/ICTransferFormField';
import FormattedNumberInput from '@/components/ic-transfer/shared/FormattedNumberInput';
import { asicInput } from '@/components/asic/ui';
import { icPurchaseDenseInput } from './icTransferFormModalLayout';
import { METAL_AMOUNT_DECIMALS } from '@/lib/icTransfer/metalSettlement';
import { complementSplitAed, complementSplitInr } from '@/lib/icTransfer/metalSplit';
import { FmtLedgerAed, FmtLedgerInr } from '@/lib/icFunds/format';

export type MetalSplitPaidProps = {
  totalInr: number;
  totalAed: number;
  paidInr: number;
  paidAed: number;
  onChange: (next: { paidInr: number; paidAed: number }) => void;
  disabled?: boolean;
  denseInput?: string;
};

export function MetalSplitPaidInrField({
  totalInr,
  totalAed,
  paidInr,
  paidAed,
  onChange,
  disabled,
  denseInput = `${asicInput} ${icPurchaseDenseInput}`,
}: MetalSplitPaidProps) {
  return (
    <ICTransferFormField label="INR paid *">
      <FormattedNumberInput
        className={denseInput}
        book="inr"
        maxFractionDigits={METAL_AMOUNT_DECIMALS}
        disabled={disabled}
        value={paidInr}
        onNumericChange={n =>
          onChange({
            paidInr: n,
            paidAed: complementSplitAed(n, totalInr, totalAed),
          })
        }
      />
    </ICTransferFormField>
  );
}

export function MetalSplitPaidAedField({
  totalInr,
  totalAed,
  paidInr,
  paidAed,
  onChange,
  disabled,
  denseInput = `${asicInput} ${icPurchaseDenseInput}`,
}: MetalSplitPaidProps) {
  return (
    <ICTransferFormField label="AED paid *">
      <FormattedNumberInput
        className={denseInput}
        book="aed"
        maxFractionDigits={METAL_AMOUNT_DECIMALS}
        disabled={disabled}
        value={paidAed}
        onNumericChange={n =>
          onChange({
            paidAed: n,
            paidInr: complementSplitInr(n, totalInr, totalAed),
          })
        }
      />
    </ICTransferFormField>
  );
}

export function MetalSplitPaidBalanceHint({
  totalInr,
  totalAed,
  paidInr,
  paidAed,
}: Pick<MetalSplitPaidProps, 'totalInr' | 'totalAed' | 'paidInr' | 'paidAed'>) {
  return (
    <p className="text-[11px] leading-snug text-slate-500">
      Remaining at sheet rate:{' '}
      <FmtLedgerInr amount={Math.max(0, (Number(totalInr) || 0) - (Number(paidInr) || 0))} />
      {' · '}
      <FmtLedgerAed amount={Math.max(0, (Number(totalAed) || 0) - (Number(paidAed) || 0))} />
    </p>
  );
}

export default function MetalSplitPaidFields(props: MetalSplitPaidProps) {
  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
      <MetalSplitPaidInrField {...props} />
      <MetalSplitPaidAedField {...props} />
      <div className="sm:col-span-2">
        <MetalSplitPaidBalanceHint
          totalInr={props.totalInr}
          totalAed={props.totalAed}
          paidInr={props.paidInr}
          paidAed={props.paidAed}
        />
      </div>
    </div>
  );
}
