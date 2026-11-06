'use client';

import { fmtLedgerAed, FmtLedgerAed } from '@/lib/icFunds/format';
import type { BalanceSheetPresentation } from '@/lib/icFunds/reportPresentation';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import { icfTd } from '@/components/ic-funds/ui';
import type { ICFundAccount } from '@/types';
import { ReportCaption } from './reportShared';

function Column({
  title,
  lines,
  totalLabel,
  total,
  slug,
  accounts,
}: {
  title: string;
  lines: BalanceSheetPresentation['assets'];
  totalLabel: string;
  total: number;
  slug: string;
  accounts: ICFundAccount[];
}) {
  return (
    <div className="border-b border-slate-200 md:border-b-0 md:border-r dark:border-[var(--theme-border)]">
      <p className="border-b border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-500">{title}</p>
      <table className="w-full">
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td className={`${icfTd} text-slate-500`} colSpan={2}>
                —
              </td>
            </tr>
          ) : (
            lines.map(line => (
              <tr key={`${line.label}-${line.accountId ?? ''}`} className="border-b border-slate-100">
                <td className={icfTd}>
                  {line.accountId ? (
                    <ICFundAccountLink
                      slug={slug}
                      accountId={line.accountId}
                      name={line.label}
                      accounts={accounts}
                    />
                  ) : (
                    line.label
                  )}
                </td>
                <td className={`${icfTd} text-right font-mono tabular-nums`}><FmtLedgerAed amount={line.amount} /></td>
              </tr>
            ))
          )}
          <tr className="bg-slate-50 font-medium">
            <td className={icfTd}>{totalLabel}</td>
            <td className={`${icfTd} text-right font-mono tabular-nums`}><FmtLedgerAed amount={total} /></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function BalanceSheetReport({
  detail,
  asAtLabel,
  balanced,
  outOfBalance,
  slug,
  accounts,
}: {
  detail: BalanceSheetPresentation;
  asAtLabel: string;
  balanced: boolean;
  outOfBalance: number;
  slug: string;
  accounts: ICFundAccount[];
}) {
  return (
    <div>
      <ReportCaption>{asAtLabel}</ReportCaption>
      <div className="grid md:grid-cols-2">
        <Column
          title="Assets"
          lines={detail.assets}
          totalLabel="Total assets"
          total={detail.totalAssets}
          slug={slug}
          accounts={accounts}
        />
        <div>
          <Column
            title="Liabilities"
            lines={detail.liabilities}
            totalLabel="Total liabilities"
            total={detail.totalLiabilities}
            slug={slug}
            accounts={accounts}
          />
          <Column
            title="Equity"
            lines={detail.equity}
            totalLabel="Total equity"
            total={detail.totalEquity}
            slug={slug}
            accounts={accounts}
          />
          <table className="w-full border-t border-slate-200">
            <tbody>
              <tr className="bg-slate-50 font-semibold">
                <td className={icfTd}>Total liabilities &amp; equity</td>
                <td className={`${icfTd} text-right font-mono tabular-nums`}>
                  <FmtLedgerAed amount={detail.totalLiabilitiesEquity} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p className={`px-2.5 py-2 text-[11px] ${balanced ? 'text-emerald-600' : 'text-amber-600'}`}>
        {balanced
          ? 'Balance sheet ties: assets equal liabilities plus equity.'
          : `Out of balance by ${fmtLedgerAed(outOfBalance)} — review opening balances or post a journal adjustment.`}
      </p>
      <p className="px-2.5 pb-2 text-[11px] text-slate-500">
        IC Stock holds unsold purchase value at cost until Cost of IC Sold is posted on sale completion.
      </p>
    </div>
  );
}
