'use client';

import React from 'react';
import type { MetalPaymentMethod } from '@/lib/icTransfer/metalInventory';

type Props = {
  value: MetalPaymentMethod;
  onChange: (method: MetalPaymentMethod) => void;
  disabled?: boolean;
};

const base =
  'inline-flex rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 text-xs font-semibold shadow-surface-xs';

const segment = (active: boolean, disabled: boolean) =>
  `rounded-md px-3 py-1.5 transition-colors ${
    active
      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
      : 'text-slate-500 hover:text-slate-800'
  }${disabled ? ' cursor-not-allowed opacity-50' : ''}`;

export default function MetalPaymentToggle({ value, onChange, disabled }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Payment method</span>
      <div className={base} role="group" aria-label="Metal payment method">
        <button
          type="button"
          className={segment(value === 'INR', !!disabled)}
          disabled={disabled}
          onClick={() => onChange('INR')}
        >
          INR
        </button>
        <button
          type="button"
          className={segment(value === 'AED', !!disabled)}
          disabled={disabled}
          onClick={() => onChange('AED')}
        >
          AED
        </button>
      </div>
      <p className="text-[10px] leading-snug text-slate-400">
        {value === 'INR'
          ? 'INR total becomes IC units. Profit = sale INR − purchase INR.'
          : 'Customer is billed in AED. Profit = sale AED − purchase AED.'}
      </p>
    </div>
  );
}
