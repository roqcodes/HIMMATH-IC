'use client';

import { IC_FUND_VOUCHER_LABELS } from '@/lib/icFunds/constants';
import { fmtICDate, FmtLedgerAmount } from '@/lib/icFunds/format';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import VoucherUserCell from '@/components/ic-funds/VoucherUserCell';
import { icfTableWrap, icfTd, icfTh, icfThAlign, icfTheadRow } from '@/components/ic-funds/ui';
import type { ICFundAccount, ICFundVoucher } from '@/types';
import { ReportCaption } from './reportShared';

export default function DayBookReport({
  vouchers,
  slug,
  accounts,
  periodLabel,
  truncated,
  book = 'AED',
}: {
  vouchers: ICFundVoucher[];
  slug: string;
  accounts: ICFundAccount[];
  periodLabel: string;
  truncated?: boolean;
  book?: 'AED' | 'INR';
}) {
  const ledgerCaption =
    book === 'INR'
      ? 'INR metal cash ledger — payments, receipts, and journals in rupees.'
      : 'AED fund ledger — IC cash and counterparty balances.';
  const sorted = [...vouchers].sort((a, b) => {
    const d = a.voucherDate.localeCompare(b.voucherDate);
    if (d !== 0) return d;
    return a.voucherNo - b.voucherNo;
  });

  return (
    <div>
      <ReportCaption>
        {periodLabel} · Day book in date order · {ledgerCaption}
        {truncated ? ' · Showing first 50,000 entries; narrow the date range for full export.' : ''}
      </ReportCaption>
      <div className={icfTableWrap}>
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className={icfTheadRow}>
              <th className={icfTh}>Date</th>
              <th className={icfTh}>Vch #</th>
              <th className={icfTh}>Type</th>
              <th className={icfTh}>Debit account</th>
              <th className={icfTh}>Credit account</th>
              <th className={icfThAlign('right')}>Amount</th>
              <th className={icfTh}>User</th>
              <th className={icfTh}>Remark</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className={`${icfTd} py-6 text-center text-slate-500`}>
                  No vouchers in this period.
                </td>
              </tr>
            ) : (
              sorted.map(row => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className={`${icfTd} tabular-nums`}>{fmtICDate(row.voucherDate)}</td>
                  <td className={`${icfTd} font-mono tabular-nums`}>
                    {row.voucherNo}
                    {row.status === 'void' ? (
                      <span className="ml-1 text-[10px] font-semibold uppercase text-red-500">VOID</span>
                    ) : null}
                    {row.status === 'pending' ? (
                      <span className="ml-1 text-[10px] font-semibold uppercase text-amber-600">PENDING</span>
                    ) : null}
                  </td>
                  <td className={icfTd}>{IC_FUND_VOUCHER_LABELS[row.voucherType]}</td>
                  <td className={icfTd}>
                    <ICFundAccountLink
                      slug={slug}
                      accountId={row.debitAccountId}
                      name={row.debitAccountName}
                      accounts={accounts}
                    />
                  </td>
                  <td className={icfTd}>
                    <ICFundAccountLink
                      slug={slug}
                      accountId={row.creditAccountId}
                      name={row.creditAccountName}
                      accounts={accounts}
                    />
                  </td>
                  <td className={`${icfTd} text-right font-mono tabular-nums`}>
                    <FmtLedgerAmount amount={row.amount} book={book} />
                  </td>
                  <td className={icfTd}>
                    <VoucherUserCell voucher={row} />
                  </td>
                  <td className={`${icfTd} max-w-[12rem] truncate text-slate-500`}>{row.notes || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
