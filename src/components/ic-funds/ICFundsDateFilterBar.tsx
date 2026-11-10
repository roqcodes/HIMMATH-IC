'use client';

import DateFilterBar from '@/components/ui/DateFilterBar';

type Props = {
  dateFilter: string;
  setDateFilter: (val: string) => void;
  customStartDate: string;
  setCustomStartDate: (val: string) => void;
  customEndDate: string;
  setCustomEndDate: (val: string) => void;
  /** Branch calendar today — keeps presets aligned with ledger filters. */
  todayAnchor?: string;
  embedded?: boolean;
};

export default function ICFundsDateFilterBar({
  dateFilter,
  setDateFilter,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  todayAnchor,
  embedded = false,
}: Props) {
  return (
    <DateFilterBar
      embedded={embedded}
      dateFilter={dateFilter}
      setDateFilter={setDateFilter}
      customStartDate={customStartDate}
      setCustomStartDate={setCustomStartDate}
      customEndDate={customEndDate}
      setCustomEndDate={setCustomEndDate}
      todayAnchor={todayAnchor}
    />
  );
}
