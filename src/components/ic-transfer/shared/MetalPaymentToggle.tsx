'use client';

import React from 'react';
import type { MetalPaymentMethod } from '@/lib/domain/books';

import { icFormFieldInnerGap } from './icTransferFormModalLayout';

type Props = {
  value: MetalPaymentMethod;
  onChange: (method: MetalPaymentMethod) => void;
  disabled?: boolean;
  /** Hide uppercase "Payment" caption — section heading covers it. */
  hideCaption?: boolean;
  /** Stretch toggle to fill the field width (equal segment buttons). */
  fullWidth?: boolean;
};

const base = (fullWidth: boolean) =>
  `${fullWidth ? 'flex w-full max-w-full ' : 'inline-flex '}rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 text-xs font-semibold shadow-surface-xs`;

const segment = (active: boolean, disabled: boolean, fullWidth: boolean) =>
  `${fullWidth ? 'flex-1 text-center ' : ''}rounded-md px-3 py-1.5 transition-[color,background-color,box-shadow,transform] duration-200 ease-out ${
    active
      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
      : 'text-slate-500 hover:text-slate-800'
  }${disabled ? ' cursor-not-allowed opacity-50' : ''}`;

export default function MetalPaymentToggle({
  value,
  onChange,
  disabled,
  hideCaption,
  fullWidth = false,
}: Props) {
  const group = (
    <div className={base(fullWidth)} role="group" aria-label="Metal payment">
      <button
        type="button"
        className={segment(value === 'CASH', !!disabled, fullWidth)}
        disabled={disabled}
        onClick={() => onChange('CASH')}
      >
        Cash (INR)
      </button>
      <button
        type="button"
        className={segment(value === 'SPLIT', !!disabled, fullWidth)}
        disabled={disabled}
        onClick={() => onChange('SPLIT')}
      >
        Split
      </button>
      <button
        type="button"
        className={segment(value === 'AED', !!disabled, fullWidth)}
        disabled={disabled}
        onClick={() => onChange('AED')}
      >
        AED
      </button>
    </div>
  );

  if (hideCaption) {
    return group;
  }

  return (
    <div className={`flex flex-col ${icFormFieldInnerGap}`}>
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Payment</span>
      {group}
    </div>
  );
}
