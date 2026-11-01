'use client';

import Link from 'next/link';
import { fmtLedgerAed } from '@/lib/icFunds/format';
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
      <ReportCaption>{periodLabel} · Active vouchers only</ReportCaption>
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
            <td className={icfTd}>Net profit / (loss) for the period</td>
            <ReportAmountCell n={statement.netForPeriod} danger={statement.netForPeriod < 0} />
          </tr>
        </tbody>
      </table>
      {statement.profitTransferred > 0.005 ? (
        <p className="px-2.5 py-2 text-[11px] text-slate-500">
          Transferred to profit reserve in period: {fmtLedgerAed(statement.profitTransferred)} (included in sales
          above; not double-counted in net).
        </p>
      ) : null}
      <p className="px-2.5 py-2 text-[11px] text-slate-500">
        Direct costs are WAC COGS on completed IC sales (cash and metal). Purchases capitalize to{' '}
        <span className="font-medium">IC Inventory</span> until sold; see balance sheet for unsold stock.
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
