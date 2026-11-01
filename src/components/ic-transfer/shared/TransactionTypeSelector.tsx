'use client';

import React from 'react';
import {
  IC_SALE_TRANSACTION_TYPE_OPTIONS,
  type ICSaleTransactionType,
} from '@/lib/icTransfer/transactionTypes';

type Props = {
  value: string;
  onChange: (value: ICSaleTransactionType) => void;
  disabled?: boolean;
};

export default function TransactionTypeSelector({ value, onChange, disabled = false }: Props) {
  return (
    <div className="flex h-8 w-full max-md:h-9 items-stretch gap-1 rounded-lg border border-[var(--theme-border-subtle)] bg-slate-100 p-0.5 shadow-surface-xs dark:bg-[var(--theme-surface-muted)]">
      {IC_SALE_TRANSACTION_TYPE_OPTIONS.map(opt => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            disabled={disabled}
            className={`min-w-0 flex-1 text-center text-[11px] font-semibold rounded-md transition-all flex items-center justify-center px-1 sm:text-xs ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/40 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
