'use client';

import StatementParticularsCell from '@/components/ic-funds/StatementParticularsCell';
import { ASICTableRowsSkeleton } from '@/components/asic/ASICTableSkeleton';
import { formatTallyAmount, formatTallyBalance, formatTallyVoucherNo, formatVocDate } from '@/lib/icFunds/tallyLedgerPdf';
import type { ICFundAccount, ICFundStatementLine } from '@/types';

function cell(extra = '') {
  return `border border-slate-300 px-2 py-1.5 align-top text-[13px] dark:border-[var(--theme-border)] ${extra}`;
}

export default function StatementLedgerTable({
  lines,
  opening,
  closing,
  currency,
  branchLabel,
  slug,
  accounts,
  loading,
}: {
  lines: ICFundStatementLine[];
  opening: number;
  closing: number;
  currency: 'AED' | 'INR';
  branchLabel: string;
  slug: string;
  accounts: ICFundAccount[];
  loading?: boolean;
}) {
  const branch = branchLabel === 'Himmath HQ' ? 'HO' : branchLabel || 'HO';
  const posted = lines.filter(l => l.voucherNo !== 0);
  const totalDr = posted.reduce((s, l) => s + (l.status === 'pending' ? 0 : l.debit), 0);
  const totalCr = posted.reduce((s, l) => s + (l.status === 'pending' ? 0 : l.credit), 0);

  return (
    <div className="overflow-x-auto px-3 py-3">
      <table className="w-full min-w-[860px] border-collapse text-left">
        <colgroup>
          <col className="w-[7%]" />
          <col className="w-[12%]" />
          <col className="w-[10%]" />
          <col className="w-[35%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
        </colgroup>
        <thead>
          <tr className="bg-slate-50 dark:bg-[var(--theme-surface-muted)]">
            <th rowSpan={2} className={`${cell('text-center text-[11px] font-semibold uppercase tracking-wide')}`}>
              Branch
            </th>
            <th rowSpan={2} className={`${cell('text-center text-[11px] font-semibold uppercase tracking-wide')}`}>
              Voucher
            </th>
            <th rowSpan={2} className={`${cell('text-center text-[11px] font-semibold uppercase tracking-wide')}`}>
              Voc Date
            </th>
            <th rowSpan={2} className={`${cell('text-center text-[11px] font-semibold uppercase tracking-wide')}`}>
              Narration
            </th>
            <th colSpan={3} className={`${cell('text-center text-[11px] font-semibold uppercase tracking-wide')}`}>
              AMOUNT IN ({currency})
            </th>
          </tr>
          <tr className="bg-slate-50 dark:bg-[var(--theme-surface-muted)]">
            <th className={`${cell('text-center text-[11px] font-semibold')}`}>Debit</th>
            <th className={`${cell('text-center text-[11px] font-semibold')}`}>Credit</th>
            <th className={`${cell('text-center text-[11px] font-semibold')}`}>Balance</th>
          </tr>
          <tr>
            <td colSpan={6} className={`${cell('text-right font-semibold')}`}>
              Balance B/F
            </td>
            <td className={`${cell('text-right font-semibold tabular-nums')}`}>{formatTallyBalance(opening)}</td>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <ASICTableRowsSkeleton rows={8} cols={7} />
          ) : posted.length === 0 ? (
            <tr>
              <td colSpan={7} className={`${cell('py-8 text-center text-slate-500')}`}>
                No movement in this period.
              </td>
            </tr>
          ) : (
            posted.map((line, i) => (
              <tr
                key={`${line.voucherNo}-${line.date}-${i}`}
                className={line.status === 'pending' ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}
              >
                <td className={`${cell('text-center')}`}>{line.branchName || branch}</td>
                <td className={`${cell('font-mono text-[12px]')}`}>
                  {formatTallyVoucherNo(line.voucherType, line.voucherNo)}
                  {line.status === 'pending' ? (
                    <div className="text-[10px] font-semibold uppercase text-amber-700">PENDING</div>
                  ) : null}
                </td>
                <td className={`${cell('text-center tabular-nums')}`}>{formatVocDate(line.date)}</td>
                <td className={cell()}>
                  <StatementParticularsCell slug={slug} line={line} accounts={accounts} />
                  {line.notes ? <span className="text-slate-500"> — {line.notes}</span> : null}
                </td>
                <td className={`${cell('text-right tabular-nums')}`}>{formatTallyAmount(line.debit)}</td>
                <td className={`${cell('text-right tabular-nums')}`}>{formatTallyAmount(line.credit)}</td>
                <td className={`${cell('text-right font-semibold tabular-nums')}`}>
                  {formatTallyBalance(line.balance)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {loading ? null : (
        <tfoot>
          <tr className="bg-slate-50 font-semibold dark:bg-[var(--theme-surface-muted)]">
            <td colSpan={4} className={`${cell('text-right')}`}>
              Total :
            </td>
            <td className={`${cell('text-right tabular-nums')}`}>{formatTallyAmount(totalDr) || '0.00'}</td>
            <td className={`${cell('text-right tabular-nums')}`}>{formatTallyAmount(totalCr) || '0.00'}</td>
            <td className={`${cell('text-right tabular-nums')}`}>{formatTallyBalance(closing)}</td>
          </tr>
        </tfoot>
        )}
      </table>
    </div>
  );
}
