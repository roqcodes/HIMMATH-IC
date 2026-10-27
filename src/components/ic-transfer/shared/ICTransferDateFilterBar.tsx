'use client';

import React from 'react';
import DateFilterBar from '@/components/ui/DateFilterBar';

type Props = {
  dateFilter: string;
  setDateFilter: (val: string) => void;
  customStartDate: string;
  setCustomStartDate: (val: string) => void;
  customEndDate: string;
  setCustomEndDate: (val: string) => void;
  trailing?: React.ReactNode;
};

export default function ICTransferDateFilterBar({
  dateFilter,
  setDateFilter,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  trailing,
}: Props) {
  return (
    <DateFilterBar
      dateFilter={dateFilter}
      setDateFilter={setDateFilter}
      customStartDate={customStartDate}
      setCustomStartDate={setCustomStartDate}
      customEndDate={customEndDate}
      setCustomEndDate={setCustomEndDate}
    >
      {trailing ? <div className="flex w-full min-w-0 items-center lg:justify-end">{trailing}</div> : null}
    </DateFilterBar>
  );
}
