'use client';

import Link from 'next/link';
import { icfTd } from '@/components/ic-funds/ui';
import { ReportAmountCell, ReportCaption } from './reportShared';

export default function MetalProfitLossReport({
  periodLabel,
  netInr,
  saleInr,
  cogsInr,
  metalSoldG,
  metalFxProfitAed,
}: {
  periodLabel: string;
  netInr: number;
  saleInr: number;
  cogsInr: number;
  metalSoldG: number;
  metalFxProfitAed?: number;
}) {
  const grams = metalSoldG.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div>
      <ReportCaption>
        {periodLabel} · Metal profit in rupees (INR) and secondary FX profit (AED).
        {metalSoldG > 0 ? ` · ${grams} g sold` : ''}
      </ReportCaption>
      {metalSoldG < 0.0001 ? (
        <p className="border-b border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          No completed metal sales in this period. Purchases and agent AED metal still appear in Warehouse statement and
          Metal register.
        </p>
      ) : null}
      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            <td className={`${icfTd} font-semibold`}>Metal sold</td>
            <ReportAmountCell n={saleInr} currency="INR" />
          </tr>
          <tr className="border-b border-slate-100">
            <td className={`${icfTd} font-medium`}>Less: Cost of metal</td>
            <ReportAmountCell n={-cogsInr} currency="INR" danger />
          </tr>
          <tr className="border-b border-slate-200 bg-slate-50 font-semibold">
            <td className={icfTd}>Metal profit / (loss) for the period (INR)</td>
            <ReportAmountCell n={netInr} currency="INR" danger={netInr < 0} />
          </tr>
          {metalFxProfitAed != null && Math.abs(metalFxProfitAed) > 0.005 ? (
            <tr className="border-b border-slate-300 bg-emerald-50/50 font-medium">
              <td className={icfTd}>Metal FX profit for the period (AED)</td>
              <ReportAmountCell n={metalFxProfitAed} currency="AED" danger={metalFxProfitAed < 0} />
            </tr>
          ) : null}
        </tbody>
      </table>
      <p className="px-2.5 py-2 text-[11px] text-slate-500">
        Sale rupees minus purchase rupees on cash metal lots.{' '}
        <Link href="/admin/reports?view=metal-trades" className="font-medium text-slate-700 underline">
          Metal register
        </Link>
        {' · '}
        <Link href="/admin/reports?view=warehouse-pl" className="font-medium text-slate-700 underline">
          Warehouse statement
        </Link>
      </p>
    </div>
  );
}
