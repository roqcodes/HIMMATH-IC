'use client';

import { accountTypeLabel } from '@/lib/icFunds/constants';
import { fmtLedgerAed, icfLedgerColumnLabel, FmtLedgerAed } from '@/lib/icFunds/format';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import { icfTableWrap, icfTd, icfTh, icfThAlign, icfTheadRow } from '@/components/ic-funds/ui';
import type { ICFundAccount, ICFundTrialBalanceLine } from '@/types';
import { fmtDrCr, ReportCaption } from './reportShared';

export default function TrialBalanceReport({
  lines,
  slug,
  accounts,
  asAtLabel,
}: {
  lines: ICFundTrialBalanceLine[];
  slug: string;
  accounts: ICFundAccount[];
  asAtLabel: string;
}) {
  const sum = (pick: (l: ICFundTrialBalanceLine) => number) =>
    lines.reduce((s, l) => s + pick(l), 0);

  return (
    <div>
      <ReportCaption>{asAtLabel} · Posted balances; pending shown separately</ReportCaption>
      <div className={icfTableWrap}>
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className={icfTheadRow}>
              <th className={icfTh}>Account</th>
              <th className={icfTh}>Type</th>
              <th className={icfThAlign('right')}>Opening Dr</th>
              <th className={icfThAlign('right')}>Opening Cr</th>
              <th className={icfThAlign('right')}>{icfLedgerColumnLabel.debit}</th>
              <th className={icfThAlign('right')}>{icfLedgerColumnLabel.credit}</th>
              <th className={icfThAlign('right')}>Closing Dr</th>
              <th className={icfThAlign('right')}>Closing Cr</th>
              <th className={icfThAlign('right')}>{icfLedgerColumnLabel.pendingDr}</th>
              <th className={icfThAlign('right')}>{icfLedgerColumnLabel.pendingCr}</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={10} className={`${icfTd} py-6 text-center text-slate-500`}>
                  No account activity in this period.
                </td>
              </tr>
            ) : (
              lines.map(line => (
                <tr key={line.accountId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className={icfTd}>
                    <ICFundAccountLink
                      slug={slug}
                      accountId={line.accountId}
                      name={line.accountName}
                      accounts={accounts}
                    />
                  </td>
                  <td className={`${icfTd} text-slate-500`}>{accountTypeLabel(line.accountType)}</td>
                  <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtDrCr(line.openingDebit ?? 0)}</td>
                  <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtDrCr(line.openingCredit ?? 0)}</td>
                  <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtDrCr(line.periodDebit ?? 0)}</td>
                  <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtDrCr(line.periodCredit ?? 0)}</td>
                  <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtDrCr(line.closingDebit ?? line.debit)}</td>
                  <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtDrCr(line.closingCredit ?? line.credit)}</td>
                  <td className={`${icfTd} text-right font-mono tabular-nums text-amber-700`}>
                    {fmtDrCr(line.pendingDebit ?? 0)}
                  </td>
                  <td className={`${icfTd} text-right font-mono tabular-nums text-amber-700`}>
                    {fmtDrCr(line.pendingCredit ?? 0)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {lines.length > 0 ? (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-medium">
                <td className={icfTd} colSpan={2}>
                  Totals (posted)
                </td>
                <td className={`${icfTd} text-right font-mono tabular-nums`}><FmtLedgerAed amount={sum(l => l.openingDebit ?? 0)} /></td>
                <td className={`${icfTd} text-right font-mono tabular-nums`}><FmtLedgerAed amount={sum(l => l.openingCredit ?? 0)} /></td>
                <td className={`${icfTd} text-right font-mono tabular-nums`}><FmtLedgerAed amount={sum(l => l.periodDebit ?? 0)} /></td>
                <td className={`${icfTd} text-right font-mono tabular-nums`}><FmtLedgerAed amount={sum(l => l.periodCredit ?? 0)} /></td>
                <td className={`${icfTd} text-right font-mono tabular-nums`}><FmtLedgerAed amount={sum(l => l.closingDebit ?? l.debit)} /></td>
                <td className={`${icfTd} text-right font-mono tabular-nums`}><FmtLedgerAed amount={sum(l => l.closingCredit ?? l.credit)} /></td>
                <td className={`${icfTd} text-right font-mono tabular-nums text-amber-700`}>
                  <FmtLedgerAed amount={sum(l => l.pendingDebit ?? 0)} />
                </td>
                <td className={`${icfTd} text-right font-mono tabular-nums text-amber-700`}>
                  <FmtLedgerAed amount={sum(l => l.pendingCredit ?? 0)} />
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
