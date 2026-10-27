'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  formatDateDDMMYY,
  parseDateDDMMYY,
  shiftCalendarDate,
  type DateStepUnit,
} from '@/lib/dateFilterPresets';

type Props = {
  label: string;
  value: string;
  stepUnit: DateStepUnit;
  onChange: (value: string) => void;
  className?: string;
};

const arrowBtnClass =
  'flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--theme-border-subtle)] bg-[var(--theme-surface-raised)] text-slate-600 transition-colors hover:border-[var(--theme-border)] hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-accent)] active:scale-95 dark:text-[var(--theme-text-secondary)]';

export default function DateRangeField({ label, value, stepUnit, onChange, className = '' }: Props) {
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => formatDateDDMMYY(value));

  useEffect(() => {
    setText(formatDateDDMMYY(value));
  }, [value]);

  const shift = (delta: number) => {
    if (!value) return;
    onChange(shiftCalendarDate(value, stepUnit, delta));
  };

  const commitText = () => {
    const parsed = parseDateDDMMYY(text);
    if (parsed) {
      onChange(parsed);
      return;
    }
    setText(formatDateDDMMYY(value));
  };

  const openNativePicker = () => {
    const input = nativeInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.focus();
    input.click();
  };

  return (
    <div className={`flex min-w-0 max-sm:flex-col max-sm:gap-1 sm:items-center sm:gap-1.5 ${className}`}>
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 sm:hidden">
        {label}
      </span>
      <span className="hidden text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:inline">
        {label}
      </span>
      <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
        <button type="button" className={arrowBtnClass} onClick={() => shift(-1)} aria-label={`Previous ${label}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div className="relative min-w-0 max-sm:flex-1 sm:shrink-0">
          <input
            type="text"
            inputMode="numeric"
            value={text}
            onChange={e => setText(e.target.value)}
            onBlur={commitText}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitText();
              }
            }}
            placeholder="DD-MM-YY"
            aria-label={label}
            className="w-full min-w-0 rounded-lg border border-[var(--theme-border-field)] bg-white py-1.5 pl-2.5 pr-8 text-xs font-semibold tabular-nums text-slate-800 shadow-[inset_0_1px_2px_rgb(15_23_42/0.04)] outline-none transition-colors focus:border-[var(--theme-accent)] focus:ring-2 focus:ring-[var(--theme-focus-ring)] sm:w-[108px] sm:text-[13px] dark:bg-[var(--theme-input-bg)] dark:text-[var(--theme-text)] dark:shadow-[inset_0_1px_2px_rgb(0_0_0/0.2)]"
          />
          <button
            type="button"
            onClick={openNativePicker}
            className="absolute right-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-red-400 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-[var(--theme-accent)] dark:hover:bg-[var(--theme-surface-hover)] dark:hover:text-[var(--theme-accent)]"
            aria-label={`Open calendar for ${label}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </button>
          <input
            ref={nativeInputRef}
            type="date"
            value={value}
            onChange={e => onChange(e.target.value)}
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 [color-scheme:light] dark:[color-scheme:dark]"
          />
        </div>

        <button type="button" className={arrowBtnClass} onClick={() => shift(1)} aria-label={`Next ${label}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
