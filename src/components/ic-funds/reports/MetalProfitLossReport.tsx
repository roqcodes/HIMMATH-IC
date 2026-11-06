'use client';

import React from 'react';
import Link from 'next/link';
import { FmtLedgerAed, FmtLedgerInr } from '@/lib/icFunds/format';
import type { PlStatement } from '@/lib/icFunds/reportPresentation';
import { icfTd } from '@/components/ic-funds/ui';
import { ReportAmountCell, ReportCaption } from './reportShared';

function SectionLines({ lines }: { lines: PlStatement['incomeLines'] }) {
  if (lines.length === 0) return null;
  return (
    <>
      {lines.map(line => (
        <tr key={line.accountId} className="border-b border-slate-100">
          <td className={`${icfTd} pl-6 text-slate-700`}>{line.accountName}</td>
          <ReportAmountCell n={line.amount} currency="INR" />
        </tr>
      ))}
    </>
  );
}

export default function MetalProfitLossReport({
  statement,
  periodLabel,
}: {
  statement: PlStatement;
  periodLabel: string;
}) {
  return (
    <div>
      <ReportCaption>{periodLabel} · Active INR vouchers · metal commodity ledger only</ReportCaption>
      <p className="mx-2.5 mb-2 rounded-md border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
        IC cash WAC and operating result stay on the{' '}
        <Link href="/admin/reports?view=profit-loss" className="font-medium underline">
          AED profit &amp; loss
        </Link>
        . This page is INR metal sales, cost of metal sold, and net commodity result only.
      </p>
      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            <td className={`${icfTd} font-semibold`}>Metal sales / income</td>
            <ReportAmountCell n={statement.salesTotal} currency="INR" />
          </tr>
          <SectionLines lines={statement.incomeLines} />

          <tr className="border-b border-slate-100">
            <td className={`${icfTd} font-medium`}>Less: Cost of metal sold</td>
            <ReportAmountCell n={-statement.directCostsTotal} currency="INR" danger />
          </tr>
          <SectionLines lines={statement.directCostLines} />

          <tr className="border-b border-slate-200 bg-slate-50/60 font-medium">
            <td className={icfTd}>Gross metal result</td>
            <ReportAmountCell n={statement.grossResult} currency="INR" danger={statement.grossResult < 0} />
          </tr>

          <tr className="border-b border-slate-300 bg-slate-50 font-semibold">
            <td className={icfTd}>Net metal profit / (loss) for the period (INR)</td>
            <ReportAmountCell n={statement.netForPeriod} currency="INR" danger={statement.netForPeriod < 0} />
          </tr>
        </tbody>
      </table>
      {statement.profitTransferred > 0.005 ? (
        <p className="px-2.5 py-2 text-[11px] text-slate-500">
          Transferred to metal profit reserve in period: <FmtLedgerInr amount={statement.profitTransferred} />
        </p>
      ) : null}
    </div>
  );
}
