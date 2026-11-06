'use client';

import Link from 'next/link';
import { FmtLedgerAed } from '@/lib/icFunds/format';
import type { PlStatement } from '@/lib/icFunds/reportPresentation';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import { icfTd } from '@/components/ic-funds/ui';
import type { ICFundAccount } from '@/types';
import { ReportAmountCell, ReportCaption } from './reportShared';

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
}: {
  statement: PlStatement;
  periodLabel: string;
  slug: string;
  accounts: ICFundAccount[];
}) {
  return (
    <div>
      <ReportCaption>{periodLabel} · Active vouchers only · IC / AED ledger</ReportCaption>
      <p className="mx-2.5 mb-2 rounded-md border border-emerald-200/80 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100">
        Cash IC WAC gross profit and operating result in AED. Metal commodity profit is on the{' '}
        <Link href="/admin/reports?view=metal-pl" className="font-medium underline">
          metal P&amp;L (INR)
        </Link>{' '}
        report — not mixed on this page.
      </p>
      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            <td className={`${icfTd} font-semibold`}>Sales / income</td>
            <ReportAmountCell n={statement.salesTotal} />
          </tr>
          <SectionLines lines={statement.incomeLines} slug={slug} accounts={accounts} />

          <tr className="border-b border-slate-100">
            <td className={`${icfTd} font-medium`}>Less: Direct costs</td>
            <ReportAmountCell n={-statement.directCostsTotal} danger />
          </tr>
          <SectionLines lines={statement.directCostLines} slug={slug} accounts={accounts} />

          <tr className="border-b border-slate-200 bg-slate-50/60 font-medium">
            <td className={icfTd}>Gross result</td>
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
          Transferred to profit reserve in period: <FmtLedgerAed amount={statement.profitTransferred} /> (included in sales
          above; not double-counted in net).
        </p>
      ) : null}
      <p className="px-2.5 py-2 text-[11px] text-slate-500">
        Ledger P&amp;L is AED only: cash IC sales post WAC COGS; metal AED agent flows post supplier cost and customer bill
        in AED — not INR commodity profit.
      </p>
      <p className="px-2.5 pb-2 text-[11px] text-slate-500">
        Voucher detail:{' '}
        <Link href="/admin/pl" className="font-medium text-slate-700 underline">
          Profit &amp; loss workspace
        </Link>
      </p>
    </div>
  );
}
