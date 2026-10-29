'use client';

import { useMemo } from 'react';
import { resolveDateFilterRange } from '@/lib/dateFilterRange';
import { resolveBranchTimeZone, todayInTimeZone } from '@/lib/businessTime';
import { useDateFilterState } from '@/hooks/useDateFilterState';

export function useICFundsDateFilter(branchTimezone?: string | null, defaultFilter = 'today') {
  const tz = resolveBranchTimeZone(branchTimezone);
  const today = useMemo(() => todayInTimeZone(tz), [tz]);

  const {
    dateFilter,
    setDateFilter,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
  } = useDateFilterState({ today, defaultFilter });

  const range = useMemo(
    () => resolveDateFilterRange(dateFilter, customStartDate, customEndDate, today),
    [dateFilter, customStartDate, customEndDate, today],
  );

  return {
    dateFilter,
    setDateFilter,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    startDate: range.startDate ?? undefined,
    endDate: range.endDate ?? undefined,
    todayAnchor: today,
    defaultVoucherDate: today,
  };
}
