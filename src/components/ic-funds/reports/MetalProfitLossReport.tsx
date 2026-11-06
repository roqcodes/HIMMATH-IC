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
}: {
  periodLabel: string;
  netInr: number;
  saleInr: number;
  cogsInr: number;
  metalSoldG: number;
}) {
  const grams = metalSoldG.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div>
      <ReportCaption>
        {periodLabel} · Metal profit in rupees (INR). Not added to AED profit.
        {metalSoldG > 0 ? ` · ${grams} g sold` : ''}
      </ReportCaption>
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
          <tr className="border-b border-slate-300 bg-slate-50 font-semibold">
            <td className={icfTd}>Metal profit / (loss) for the period (INR)</td>
            <ReportAmountCell n={netInr} currency="INR" danger={netInr < 0} />
          </tr>
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
