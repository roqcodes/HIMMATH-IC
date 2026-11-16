'use client';

import React from 'react';
import type { ICManagerDealStatementLine } from '@/app/actions/icFundsActions';
import { fmtICDate, FmtLedgerAmount } from '@/lib/icFunds/format';
import { formatTallyVoucherNo } from '@/lib/icFunds/tallyLedgerPdf';
import { icfCard, icfTableWrap, icfTd, icfTh, icfThAlign, icfTheadRow } from '@/components/ic-funds/ui';
import { ASICTableRowsSkeleton } from '@/components/asic/ASICTableSkeleton';

export default function ManagerDealStatementTable({
  managerName,
  lines,
  loading = false,
}: {
  managerName: string;
  lines: ICManagerDealStatementLine[];
  loading?: boolean;
}) {
  return (
    <div id="icf-manager-deal-statement" className="space-y-3 px-4 py-3">
      <div className={`${icfCard} flex flex-wrap items-center justify-between gap-2 px-3 py-2`}>
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-[var(--theme-text)]">Manager deal activity</h2>
          <p className="text-[11px] text-slate-500">Manager: {managerName} · Purchases, sales, payments, receipts and deposits</p>
        </div>
      </div>
      <div className={icfTableWrap}>
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className={icfTheadRow}>
              <th className={icfTh}>Date</th>
              <th className={icfTh}>Voucher</th>
              <th className={icfTh}>From</th>
              <th className={icfTh}>To</th>
              <th className={icfTh}>Book</th>
              <th className={icfThAlign('right')}>Amount</th>
              <th className={icfTh}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <ASICTableRowsSkeleton rows={6} cols={7} />
            ) : lines.length === 0 ? (
              <tr><td colSpan={7} className={`${icfTd} py-8 text-center text-sm text-slate-500`}>No primary activity for this manager in the selected period.</td></tr>
            ) : lines.map((line, index) => (
              <tr key={`${line.book}-${line.voucherNo}-${index}`} className="border-b border-slate-100 dark:border-[var(--theme-border-subtle)]">
                <td className={`${icfTd} whitespace-nowrap tabular-nums`}>{fmtICDate(line.date)}</td>
                <td className={`${icfTd} whitespace-nowrap font-mono text-xs`}>
                  <span className="block font-sans text-sm font-medium">{line.entryLabel}</span>
                  <span className="text-[10px] text-slate-500">Journal {formatTallyVoucherNo(line.voucherType, line.voucherNo)}</span>
                </td>
                <td className={`${icfTd} min-w-36`}>{line.fromParty}</td>
                <td className={`${icfTd} min-w-36`}>{line.toParty}</td>
                <td className={icfTd}>{line.book}</td>
                <td className={`${icfTd} text-right font-mono font-medium tabular-nums`}><FmtLedgerAmount amount={line.amount} book={line.book} /></td>
                <td className={`${icfTd} max-w-[18rem] text-slate-500`}>{line.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
