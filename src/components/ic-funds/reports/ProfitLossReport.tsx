'use client';

import type { PlStatement } from '@/lib/icFunds/reportPresentation';
import { icfTd } from '@/components/ic-funds/ui';
import { ReportAmountCell, ReportCaption, ReportSegmentTabs } from './reportShared';
import MetalProfitLossReport from './MetalProfitLossReport';

export default function ProfitLossReport({
  statement,
  periodLabel,
  icRevenueAed,
  icCogsAed,
  periodMetalPlInr,
  metalSoldG,
  metalSaleInr,
  metalCogsInr,
  metalFxProfitAed,
  book,
  onBookChange,
}: {
  statement: PlStatement;
  periodLabel: string;
  icRevenueAed: number;
  icCogsAed: number;
  periodMetalPlInr?: number | null;
  metalSoldG?: number;
  metalSaleInr?: number;
  metalCogsInr?: number;
  metalFxProfitAed?: number;
  book: 'aed' | 'inr';
  onBookChange: (book: 'aed' | 'inr') => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-2.5 py-2 dark:border-[var(--theme-border)]">
        <ReportSegmentTabs
          label="Profit and loss book"
          value={book}
          onChange={onBookChange}
          options={[
            { id: 'aed', label: 'IC (AED)' },
            { id: 'inr', label: 'Metal (INR)' },
          ]}
        />
      </div>

      {book === 'inr' ? (
        <MetalProfitLossReport
          periodLabel={periodLabel}
          netInr={periodMetalPlInr ?? 0}
          saleInr={metalSaleInr ?? 0}
          cogsInr={metalCogsInr ?? 0}
          metalSoldG={metalSoldG ?? 0}
          metalFxProfitAed={metalFxProfitAed ?? 0}
        />
      ) : (
        <>
          <ReportCaption>
            {periodLabel} · IC warehouse profit in dirhams (AED). Metal profit in rupees is shown separately on the other tab.
          </ReportCaption>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <td className={`${icfTd} font-semibold`}>IC sales</td>
                <ReportAmountCell n={icRevenueAed} />
              </tr>
              <tr className="border-b border-slate-100">
                <td className={`${icfTd} font-medium`}>Less: IC cost of goods sold</td>
                <ReportAmountCell n={-icCogsAed} danger />
              </tr>
              <tr className="border-b border-slate-300 bg-slate-50 font-semibold">
                <td className={icfTd}>IC profit / (loss) for the period (AED)</td>
                <ReportAmountCell n={statement.netForPeriod} danger={statement.netForPeriod < 0} />
              </tr>
            </tbody>
          </table>
          <p className="px-2.5 py-2 text-[11px] text-slate-500">
            Unsold IC stays in inventory until sale. Metal profit is shown separately in INR on the Metal tab.
          </p>
        </>
      )}
    </div>
  );
}
