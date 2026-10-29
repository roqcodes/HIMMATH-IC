'use client';

import React, { useEffect, useState } from 'react';
import { formInput, formLabel } from '@/lib/ui';
import {
  formatRateFieldDisplay,
  isIncompleteDecimalInput,
  parseRateFieldInput,
} from '@/lib/icTransfer/rateFieldInput';
import type { ICRateTransactionPricing } from '@/types';

type Props = {
  pricing: ICRateTransactionPricing;
  currency: string;
  convertedRateOnly?: boolean;
  lockedConversionRate?: number;
  onChange: (next: ICRateTransactionPricing) => void;
};

export default function FlatRateFields({
  pricing,
  currency,
  convertedRateOnly = false,
  onChange,
}: Props) {
  const sale = pricing.saleRate ?? null;
  const displayValue = sale;

  const [text, setText] = useState(() => formatRateFieldDisplay(displayValue));

  useEffect(() => {
    setText(formatRateFieldDisplay(displayValue));
  }, [displayValue]);

  const commitFlat = (nextSale: number | null) => {
    onChange({
      mode: 'flat',
      saleRate: nextSale ?? undefined,
      conversionRate: 1,
    });
  };

  return (
    <div className="w-full max-w-[160px]">
      <label className={formLabel}>Rate ({currency})</label>
      <input
        type="text"
        inputMode="decimal"
        className={`${formInput} tabular-nums`}
        value={text}
        placeholder="—"
        onChange={e => {
          const raw = e.target.value;
          if (raw !== '' && !/^-?\d*\.?\d*$/u.test(raw)) return;
          setText(raw);
          if (raw.trim() === '' || isIncompleteDecimalInput(raw)) {
            if (raw.trim() === '') commitFlat(null);
            return;
          }
          const next = parseRateFieldInput(raw);
          if (next == null) {
            commitFlat(null);
            return;
          }
          commitFlat(next);
        }}
      />
    </div>
  );
}
