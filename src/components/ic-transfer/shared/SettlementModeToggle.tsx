'use client';

import React from 'react';
import type { ICSettlementMode } from '@/lib/icTransfer/metalSettlement';

type Props = {
  value: ICSettlementMode;
  onChange: (mode: ICSettlementMode) => void;
  disabled?: boolean;
  lockMode?: boolean;
  className?: string;
};

const base =
  'inline-flex rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 text-xs font-semibold shadow-surface-xs [&:is(.w-full)]:flex [&:is(.w-full)]:w-full';

const segment = (active: boolean, disabled: boolean, stretch?: boolean) =>
  `${stretch ? 'flex-1 text-center ' : ''}rounded-md px-3 py-1.5 transition-colors ${
    active
      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
      : 'text-slate-500 hover:text-slate-800'
  }${disabled ? ' cursor-not-allowed opacity-50' : ''}`;

export default function SettlementModeToggle({ value, onChange, disabled, lockMode, className }: Props) {
  const stretch = Boolean(className?.includes('w-full'));
  return (
    <div className={`${base}${className ? ` ${className}` : ''}`} role="group" aria-label="Settlement mode">
      <button
        type="button"
        className={segment(value === 'cash', !!disabled || !!lockMode, stretch)}
        disabled={disabled || lockMode}
        onClick={() => onChange('cash')}
      >
        Cash
      </button>
      <button
        type="button"
        className={segment(value === 'metal', !!disabled || !!lockMode, stretch)}
        disabled={disabled || lockMode}
        onClick={() => onChange('metal')}
      >
        Metal
      </button>
    </div>
  );
}
