'use client';

import React, { useMemo, useState } from 'react';
import DateRangeField from '@/components/ui/DateRangeField';
import {
  ALL_TIME_START,
  resolveDisplayDates,
  todayISO,
  type DateStepUnit,
} from '@/lib/dateFilterPresets';
import { resolveDateFilterRange } from '@/lib/dateFilterRange';

interface DateFilterBarProps {
  dateFilter: string;
  setDateFilter: (val: string) => void;
  customStartDate: string;
  setCustomStartDate: (val: string) => void;
  customEndDate: string;
  setCustomEndDate: (val: string) => void;
  /** Branch calendar today (YYYY-MM-DD). Defaults to UTC “today” when omitted. */
  todayAnchor?: string;
  children?: React.ReactNode;
  /** Flat layout inside a parent toolbar (no outer card). */
  embedded?: boolean;
}

const PRESETS = [
  { id: 'all-time', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'this-week', label: 'Week' },
  { id: 'this-month', label: 'Month' },
] as const;

const STEP_UNITS: { id: DateStepUnit; title: string }[] = [
  { id: 'Y', title: 'Year' },
  { id: 'M', title: 'Month' },
  { id: 'D', title: 'Day' },
];

const presetClass = (active: boolean, embedded: boolean) =>
  `inline-flex h-8 min-w-0 items-center justify-center rounded-md font-medium transition-colors max-md:flex-1 max-md:px-2 max-md:text-[10px] md:shrink-0 md:px-3 md:text-xs ${
    active
      ? embedded
        ? 'bg-slate-900 text-white shadow-sm dark:bg-[var(--theme-text-primary)]'
        : 'bg-red-600 text-white shadow-sm shadow-red-600/25 dark:bg-[var(--theme-accent)] dark:shadow-none'
      : embedded
        ? 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-[var(--theme-surface-raised)] dark:text-[var(--theme-text-secondary)] dark:ring-[var(--theme-border)]'
        : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-red-50 hover:text-red-700 hover:ring-red-200 dark:bg-[var(--theme-surface-raised)] dark:text-[var(--theme-text-secondary)] dark:ring-[var(--theme-border)] dark:hover:bg-[var(--theme-surface-hover)] dark:hover:text-[var(--theme-accent)] dark:hover:ring-[var(--theme-border-strong)]'
  }`;

const stepUnitClass = (active: boolean, embedded: boolean) =>
  `flex size-7 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold transition-colors md:size-8 md:text-[11px] ${
    active
      ? embedded
        ? 'bg-slate-900 text-white dark:bg-[var(--theme-text-primary)]'
        : 'bg-red-600 text-white shadow-sm dark:bg-[var(--theme-accent)]'
      : embedded
        ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-[var(--theme-text-muted)] dark:hover:bg-[var(--theme-surface-hover)]'
        : 'text-slate-500 hover:bg-red-50 hover:text-red-700 dark:text-[var(--theme-text-muted)] dark:hover:bg-[var(--theme-surface-hover)] dark:hover:text-[var(--theme-accent)]'
  }`;

export default function DateFilterBar({
  dateFilter,
  setDateFilter,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  todayAnchor,
  children,
  embedded = false,
}: DateFilterBarProps) {
  const today = useMemo(() => todayAnchor || todayISO(), [todayAnchor]);
  const [stepUnit, setStepUnit] = useState<DateStepUnit>('D');

  const { from, to } = useMemo(
    () => resolveDisplayDates(dateFilter, customStartDate, customEndDate, today),
    [dateFilter, customStartDate, customEndDate, today],
  );

  const applyCustomRange = (nextFrom: string, nextTo: string) => {
    const start = nextFrom || today;
    const end = nextTo || start;
    setDateFilter('custom');
    setCustomStartDate(start <= end ? start : end);
    setCustomEndDate(start <= end ? end : start);
  };

  const applyPreset = (id: (typeof PRESETS)[number]['id']) => {
    if (id === 'all-time') {
      setDateFilter('all-time');
      setCustomStartDate(ALL_TIME_START);
      setCustomEndDate(today);
      return;
    }
    const range = resolveDateFilterRange(id, '', '', today);
    setDateFilter(id);
    setCustomStartDate(range.startDate || today);
    setCustomEndDate(range.endDate || today);
  };

  const handleFromChange = (value: string) => {
    if (!value) return;
    applyCustomRange(value, to);
  };

  const handleToChange = (value: string) => {
    if (!value) return;
    applyCustomRange(from, value);
  };

  return (
    <div
      className={
        embedded
          ? 'min-w-0'
          : 'mb-3 rounded-lg border border-[var(--theme-border-subtle)] bg-[var(--theme-surface)] p-3 shadow-surface-xs'
      }
    >
      <div className={`flex flex-col gap-2.5 ${embedded ? '' : 'lg:flex-row lg:items-center lg:justify-between'}`}>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 max-md:w-full lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div
            className="flex min-w-0 flex-1 items-center justify-start gap-1 max-md:w-full md:gap-1.5"
            role="group"
            aria-label="Date range presets"
          >
            {PRESETS.map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className={presetClass(dateFilter === preset.id, embedded)}
                aria-pressed={dateFilter === preset.id}
              >
                {preset.label}
              </button>
            ))}

            <div
              className={`ml-1 flex shrink-0 items-center gap-0.5 rounded-md border p-0.5 ${
                embedded
                  ? 'border-slate-200 bg-slate-50/80 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-muted)]'
                  : 'border-red-100 bg-white dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-raised)]'
              }`}
              role="group"
              aria-label="Date step unit"
            >
              {STEP_UNITS.map(unit => (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => setStepUnit(unit.id)}
                  className={stepUnitClass(stepUnit === unit.id, embedded)}
                  aria-pressed={stepUnit === unit.id}
                  title={unit.title}
                >
                  {unit.id}
                </button>
              ))}
            </div>
          </div>

          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 max-md:w-full sm:max-w-md lg:ml-auto lg:justify-items-stretch">
            <DateRangeField label="From" value={from} stepUnit={stepUnit} onChange={handleFromChange} />
            <DateRangeField label="To" value={to} stepUnit={stepUnit} onChange={handleToChange} />
          </div>
        </div>

        {children ? (
          <div className="flex w-full min-w-0 shrink-0 items-center justify-end lg:w-auto lg:min-w-[240px]">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
