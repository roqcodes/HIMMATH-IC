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
  children?: React.ReactNode;
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

const presetClass = (active: boolean) =>
  `inline-flex h-8 min-w-0 items-center justify-center rounded-lg font-semibold tracking-wide shadow-surface-xs transition-colors max-md:flex-1 max-md:px-2 max-md:text-[10px] md:shrink-0 md:px-3.5 md:text-xs ${
    active
      ? 'bg-red-600 text-white shadow-sm shadow-red-600/25 dark:bg-[var(--theme-accent)] dark:shadow-none'
      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-red-50 hover:text-red-700 hover:ring-red-200 dark:bg-[var(--theme-surface-raised)] dark:text-[var(--theme-text-secondary)] dark:ring-[var(--theme-border)] dark:hover:bg-[var(--theme-surface-hover)] dark:hover:text-[var(--theme-accent)] dark:hover:ring-[var(--theme-border-strong)]'
  }`;

const stepUnitClass = (active: boolean) =>
  `flex size-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold transition-colors md:size-8 md:text-[11px] ${
    active
      ? 'bg-red-600 text-white shadow-sm dark:bg-[var(--theme-accent)]'
      : 'text-slate-500 hover:bg-red-50 hover:text-red-700 dark:text-[var(--theme-text-muted)] dark:hover:bg-[var(--theme-surface-hover)] dark:hover:text-[var(--theme-accent)]'
  }`;

export default function DateFilterBar({
  dateFilter,
  setDateFilter,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  children,
}: DateFilterBarProps) {
  const today = useMemo(() => todayISO(), []);
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
    <div className="mb-3 rounded-lg border border-[var(--theme-border-subtle)] bg-[var(--theme-surface)] p-3 shadow-surface-xs">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2.5 max-md:w-full md:flex-row md:flex-wrap md:items-center">
          <div
            className="flex min-w-0 items-center gap-1 max-md:w-full md:gap-1.5"
            role="group"
            aria-label="Date range presets"
          >
            {PRESETS.map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className={presetClass(dateFilter === preset.id)}
                aria-pressed={dateFilter === preset.id}
              >
                {preset.label}
              </button>
            ))}

            <div
              className="ml-1 flex shrink-0 items-center gap-0.5 rounded-lg border border-red-100 bg-white p-0.5 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-raised)]"
              role="group"
              aria-label="Date step unit"
            >
              {STEP_UNITS.map(unit => (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => setStepUnit(unit.id)}
                  className={stepUnitClass(stepUnit === unit.id)}
                  aria-pressed={stepUnit === unit.id}
                  title={unit.title}
                >
                  {unit.id}
                </button>
              ))}
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-2 max-md:w-full md:flex md:flex-row md:items-center md:gap-3">
            <DateRangeField label="From" value={from} stepUnit={stepUnit} onChange={handleFromChange} />
            <DateRangeField label="To" value={to} stepUnit={stepUnit} onChange={handleToChange} />
          </div>
        </div>

        {children ? (
          <div className="flex w-full min-w-0 shrink-0 items-center lg:ml-auto lg:w-auto lg:min-w-[240px] lg:max-w-none">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
