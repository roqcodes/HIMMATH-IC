'use client';

import React from 'react';

type Props = {
  value: 'AED' | 'INR';
  onChange: (book: 'AED' | 'INR') => void;
  disabled?: boolean;
  className?: string;
};

const base =
  'inline-flex rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 text-xs font-semibold shadow-surface-xs dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-muted)]';

const segment = (active: boolean, disabled: boolean) =>
  `rounded-md px-3 py-1.5 transition-colors ${
    active
      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80 dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text)] dark:ring-[var(--theme-border)]'
      : 'text-slate-500 hover:text-slate-800 dark:text-[var(--theme-text-secondary)] dark:hover:text-[var(--theme-text)]'
  }${disabled ? ' cursor-not-allowed opacity-50' : ''}`;

export default function CapitalBookToggle({ value, onChange, disabled, className }: Props) {
  return (
    <div className={`${base}${className ? ` ${className}` : ''}`} role="group" aria-label="Ledger book">
      <button
        type="button"
        className={segment(value === 'AED', !!disabled)}
        disabled={disabled}
        onClick={() => onChange('AED')}
      >
        AED
      </button>
      <button
        type="button"
        className={segment(value === 'INR', !!disabled)}
        disabled={disabled}
        onClick={() => onChange('INR')}
      >
        INR
      </button>
    </div>
  );
}
