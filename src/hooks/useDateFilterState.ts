'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  resolveInitialDateFilterState,
  writeDateFilterSession,
  type DateFilterSessionState,
} from '@/lib/dateFilterSession';
import { todayISO } from '@/lib/dateFilterPresets';

type Options = {
  /** Anchor "today" as YYYY-MM-DD (branch timezone for IC Funds). */
  today?: string;
  /** Used only when no session value exists yet. */
  defaultFilter?: string;
};

export function useDateFilterState(options: Options = {}) {
  const today = options.today ?? todayISO();
  const defaultFilter = options.defaultFilter ?? 'today';

  const [state, setState] = useState<DateFilterSessionState>(() =>
    resolveInitialDateFilterState(today, defaultFilter),
  );

  useEffect(() => {
    writeDateFilterSession(state);
  }, [state]);

  const setDateFilter = useCallback((dateFilter: string) => {
    setState(current => ({ ...current, dateFilter }));
  }, []);

  const setCustomStartDate = useCallback((customStartDate: string) => {
    setState(current => ({ ...current, customStartDate }));
  }, []);

  const setCustomEndDate = useCallback((customEndDate: string) => {
    setState(current => ({ ...current, customEndDate }));
  }, []);

  return {
    dateFilter: state.dateFilter,
    setDateFilter,
    customStartDate: state.customStartDate,
    setCustomStartDate,
    customEndDate: state.customEndDate,
    setCustomEndDate,
  };
}
