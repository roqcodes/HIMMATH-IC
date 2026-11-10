'use client';

import Link from 'next/link';
import { FmtLedgerAed } from '@/lib/icFunds/format';
import type { PlStatement } from '@/lib/icFunds/reportPresentation';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import { icfTd } from '@/components/ic-funds/ui';
import type { ICFundAccount } from '@/types';
import { ReportAmountCell, ReportCaption, ReportSegmentTabs } from './reportShared';
import MetalProfitLossReport from './MetalProfitLossReport';

function SectionLines({
  lines,
  slug,
  accounts,
}: {
  lines: PlStatement['incomeLines'];
  slug: string;
  accounts: ICFundAccount[];
}) {
  if (lines.length === 0) return null;
  return (
    <>
      {lines.map(line => (
        <tr key={line.accountId} className="border-b border-slate-100">
          <td className={`${icfTd} pl-6`}>
            <ICFundAccountLink slug={slug} accountId={line.accountId} name={line.accountName} accounts={accounts} />
          </td>
          <ReportAmountCell n={line.amount} />
        </tr>
      ))}
    </>
  );
}

export default function ProfitLossReport({
  statement,
  periodLabel,
  slug,
  accounts,
  periodMetalPlInr,
  metalSoldG,
  metalSaleInr,
  metalCogsInr,
  book,
  onBookChange,
}: {
  statement: PlStatement;
  periodLabel: string;
  slug: string;
  accounts: ICFundAccount[];
  periodMetalPlInr?: number | null;
  metalSoldG?: number;
  metalSaleInr?: number;
  metalCogsInr?: number;
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
            { id: 'aed', label: 'AED ledger' },
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
        />
      ) : (
        <>
          <ReportCaption>
            {periodLabel} · Profit and loss in dirhams (AED). Metal profit in rupees is on the other tab — do not add
            them.
          </ReportCaption>
          {Math.abs(statement.netForPeriod) < 0.005 &&
          statement.incomeLines.length === 0 &&
          statement.directCostLines.length === 0 &&
          statement.operatingLines.length === 0 ? (
            <p className="border-b border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
              No income, expense, or COGS accounts moved in this period. Payments, agent journals, and inventory
              purchases still show on Day book and Warehouse statement with the same date filter.
            </p>
          ) : null}
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <td className={`${icfTd} font-semibold`}>Sales</td>
                <ReportAmountCell n={statement.salesTotal} />
              </tr>
              <SectionLines lines={statement.incomeLines} slug={slug} accounts={accounts} />

              <tr className="border-b border-slate-100">
                <td className={`${icfTd} font-medium`}>Less: Cost of IC sold</td>
                <ReportAmountCell n={-statement.directCostsTotal} danger />
              </tr>
              <SectionLines lines={statement.directCostLines} slug={slug} accounts={accounts} />

              <tr className="border-b border-slate-200 bg-slate-50/60 font-medium">
                <td className={icfTd}>Gross profit</td>
                <ReportAmountCell n={statement.grossResult} danger={statement.grossResult < 0} />
              </tr>

              <tr className="border-b border-slate-100">
                <td className={`${icfTd} font-medium`}>Less: Operating expenses</td>
                <ReportAmountCell n={-statement.operatingTotal} danger />
              </tr>
              <SectionLines lines={statement.operatingLines} slug={slug} accounts={accounts} />

              <tr className="border-b border-slate-300 bg-slate-50 font-semibold">
                <td className={icfTd}>Net profit / (loss) for the period (AED)</td>
                <ReportAmountCell n={statement.netForPeriod} danger={statement.netForPeriod < 0} />
              </tr>
            </tbody>
          </table>
          {statement.profitTransferred > 0.005 ? (
            <p className="px-2.5 py-2 text-[11px] text-slate-500">
              Transferred to profit reserve: <FmtLedgerAed amount={statement.profitTransferred} /> (already in sales;
              not counted twice).
            </p>
          ) : null}
          <p className="px-2.5 py-2 text-[11px] text-slate-500">
            Unsold IC stays in inventory until the sale completes. Metal settled with an AED agent is in this AED book;
            cash metal profit is rupees on the Metal (INR) tab.{' '}
            <Link href="/admin/pl" className="font-medium text-slate-700 underline">
              Voucher detail
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
