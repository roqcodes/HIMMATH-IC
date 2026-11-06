'use client';

import { fmtLedgerAed, FmtLedgerAed, icfLedgerColumnLabel } from '@/lib/icFunds/format';
import type { AccountPeriodLedger } from '@/lib/icFunds/accountPeriodBalance';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import { BalanceWithPending } from '@/components/ic-funds/BalanceWithPending';
import { icfTableWrap, icfTd, icfTh, icfThAlign, icfTheadRow } from '@/components/ic-funds/ui';
import type { ICFundAccount } from '@/types';
import { AED_LEDGER_CAPTION, fmtDrCr, ReportCaption } from './reportShared';

export default function CashBankBookReport({
  ledgers,
  slug,
  accounts,
  asAtLabel,
  periodLabel,
}: {
  ledgers: AccountPeriodLedger[];
  slug: string;
  accounts: ICFundAccount[];
  asAtLabel: string;
  periodLabel: string;
}) {
  const bankLedgers = ledgers.filter(l => l.accountType === 'bank');

  return (
    <div>
      <ReportCaption>
        {periodLabel} · {asAtLabel} · {AED_LEDGER_CAPTION}
      </ReportCaption>
      <div className={icfTableWrap}>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className={icfTheadRow}>
              <th className={icfTh}>Account</th>
              <th className={icfThAlign('right')}>Opening</th>
              <th className={icfThAlign('right')}>Receipts (Dr)</th>
              <th className={icfThAlign('right')}>Payments (Cr)</th>
              <th className={icfThAlign('right')}>{icfLedgerColumnLabel.balance}</th>
              <th className={icfThAlign('right')}>Pending</th>
            </tr>
          </thead>
          <tbody>
            {bankLedgers.length === 0 ? (
              <tr>
                <td colSpan={6} className={`${icfTd} py-6 text-center text-slate-500`}>
                  No bank accounts yet.
                </td>
              </tr>
            ) : (
              bankLedgers.map(row => {
                const account = accounts.find(a => a.id === row.accountId);
                return (
                  <tr key={row.accountId} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className={icfTd}>
                      <ICFundAccountLink
                        slug={slug}
                        accountId={row.accountId}
                        name={row.accountName}
                        accounts={accounts}
                      />
                    </td>
                    <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtDrCr(row.opening)}</td>
                    <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtDrCr(row.periodDebit)}</td>
                    <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtDrCr(row.periodCredit)}</td>
                    <td className={`${icfTd} text-right font-mono tabular-nums`}>
                      <BalanceWithPending balance={row.closing} pendingBalance={row.pendingBalance} />
                    </td>
                    <td className={`${icfTd} text-right font-mono tabular-nums text-amber-700`}>
                      {Math.abs(row.pendingBalance) > 0.005 ? <FmtLedgerAed amount={row.pendingBalance} /> : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
