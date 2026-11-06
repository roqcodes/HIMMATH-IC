'use client';

import React from 'react';

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  tone?: 'accent' | 'emerald' | 'amber';
};

export default function ToggleSwitch({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
  tone = 'accent',
}: Props) {
  const trackOn =
    tone === 'emerald' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-accent';

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border border-[var(--theme-border-subtle)] bg-slate-50/80 px-3 py-2.5 shadow-surface-xs dark:bg-[var(--theme-surface-muted)] ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? trackOn : 'bg-slate-200'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
