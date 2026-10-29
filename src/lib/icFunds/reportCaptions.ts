import { fmtICDate } from '@/lib/icFunds/format';

export function formatReportPeriodCaption(opts: {
  startDate?: string | null;
  endDate?: string | null;
}): { periodLabel: string; asAtLabel: string } {
  const { startDate, endDate } = opts;
  if (startDate && endDate) {
    return {
      periodLabel: `For the period ${fmtICDate(startDate)} to ${fmtICDate(endDate)}`,
      asAtLabel: `As at ${fmtICDate(endDate)}`,
    };
  }
  if (endDate) {
    return {
      periodLabel: `Through ${fmtICDate(endDate)}`,
      asAtLabel: `As at ${fmtICDate(endDate)}`,
    };
  }
  if (startDate) {
    return {
      periodLabel: `From ${fmtICDate(startDate)}`,
      asAtLabel: 'All dates',
    };
  }
  return {
    periodLabel: 'All time',
    asAtLabel: 'Current balances',
  };
}
