'use client';

import { useEffect, useMemo, useState } from 'react';
import { resolveDateFilterRange } from '@/lib/dateFilterRange';
import { resolveBranchTimeZone, todayInTimeZone } from '@/lib/businessTime';
import { useDateFilterState } from '@/hooks/useDateFilterState';

export function useICFundsDateFilter(branchTimezone?: string | null, defaultFilter = 'today') {
  const tz = resolveBranchTimeZone(branchTimezone);
  const [today, setToday] = useState(() => todayInTimeZone(tz));

  useEffect(() => {
    const refreshToday = () => setToday(todayInTimeZone(tz));
    refreshToday();
    const interval = window.setInterval(refreshToday, 60_000);
    window.addEventListener('focus', refreshToday);
    document.addEventListener('visibilitychange', refreshToday);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshToday);
      document.removeEventListener('visibilitychange', refreshToday);
    };
  }, [tz]);

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
