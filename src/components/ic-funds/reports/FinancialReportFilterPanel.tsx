'use client';

import React from 'react';
import ICFundsDateFilterBar from '@/components/ic-funds/ICFundsDateFilterBar';
import ReportFilterBar, { type ReportFilterBarProps } from '@/components/ic-funds/reports/ReportFilterBar';

const sectionEyebrow =
  'text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-[var(--theme-text-muted)]';

type DateProps = {
  dateFilter: string;
  setDateFilter: (val: string) => void;
  customStartDate: string;
  setCustomStartDate: (val: string) => void;
  customEndDate: string;
  setCustomEndDate: (val: string) => void;
};

type Props = {
  date: DateProps;
  filters: ReportFilterBarProps;
};

export default function FinancialReportFilterPanel({ date, filters }: Props) {
  return (
    <div className="border-b border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-muted)]/40">
      <div className="flex flex-col gap-3">
        <div>
          <p className={`${sectionEyebrow} mb-2`}>Period</p>
          <ICFundsDateFilterBar embedded {...date} />
        </div>

        <div className="h-px bg-slate-200/90 dark:bg-[var(--theme-border-subtle)]" aria-hidden />

        <div>
          <p className={`${sectionEyebrow} mb-2`}>Filters</p>
          <ReportFilterBar {...filters} />
        </div>
      </div>
    </div>
  );
}
