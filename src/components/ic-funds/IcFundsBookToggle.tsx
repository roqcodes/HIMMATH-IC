'use client';

import React from 'react';

type Props = {
  value: 'AED' | 'INR';
  onChange: (book: 'AED' | 'INR') => void;
  disabled?: boolean;
  allowInr?: boolean;
  size?: 'sm' | 'md';
  'aria-label'?: string;
};

function btnClass(active: boolean, sm: boolean) {
  const h = sm ? 'h-8' : 'h-9';
  return `inline-flex ${h} min-w-[3.25rem] items-center justify-center rounded-md px-3 text-xs font-semibold transition-colors ${
    active
      ? 'bg-red-600 text-white shadow-sm shadow-red-600/25'
      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-red-50 hover:text-red-700 hover:ring-red-200'
  }`;
}

export default function IcFundsBookToggle({
  value,
  onChange,
  disabled,
  allowInr = true,
  size = 'sm',
  'aria-label': ariaLabel = 'Settlement currency',
}: Props) {
  return (
    <div
      className="flex items-center gap-1"
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        disabled={disabled}
        className={btnClass(value === 'AED', size === 'sm')}
        onClick={() => onChange('AED')}
      >
        AED
      </button>
      <button
        type="button"
        disabled={disabled || !allowInr}
        title={!allowInr ? 'INR is not available for this entry type' : undefined}
        className={`${btnClass(value === 'INR', size === 'sm')} ${!allowInr ? 'cursor-not-allowed opacity-40' : ''}`}
        onClick={() => allowInr && onChange('INR')}
      >
        INR
      </button>
    </div>
  );
}
