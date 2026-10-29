'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  getCustomerICFundStatementAction,
  getICFundAccountByCustomerIdAction,
} from '@/app/actions/icFundsActions';
import VoucherUserCell from '@/components/ic-funds/VoucherUserCell';
import { IC_FUND_VOUCHER_LABELS } from '@/lib/icFunds/constants';
import {
  buildCustomerStatementCsv,
  buildCustomerStatementView,
  downloadCustomerStatementCsv,
  printCustomerStatementPdf,
  statementCsvFilename,
} from '@/lib/icFunds/customerStatementView';
import { IC_FUNDS_BASE_CURRENCY } from '@/lib/icFunds/currencyPolicy';
import { fmtICDate, fmtLedgerAed, icfLedgerColumnLabel } from '@/lib/icFunds/format';
import { icFundsReportPath } from '@/lib/icFunds/nav';
import StatementParticularsCell from '@/components/ic-funds/StatementParticularsCell';
import { asicBtnPrimary, asicCard, asicTable, asicTd, asicTh, asicThAlign, asicTheadRow, asicTr, asicTableWrap } from '@/components/asic/ui';
import { btnGhost, btnSecondary } from '@/lib/ui';
import type { Customer, ICFundAccount, ICFundStatementLine } from '@/types';
import { ASICTableSkeleton } from '@/components/asic/ASICTableSkeleton';
import { useApp } from '@/context/AppContext';

interface Props {
  slug: string;
  branchId: string;
  customer: Customer;
  icFundAccount?: ICFundAccount | null;
  branchName?: string;
}

function AmountCell({ n, danger }: { n: number; danger?: boolean }) {
  return (
    <td
      className={`${asicTd} text-right font-mono tabular-nums ${danger || n < 0 ? 'text-red-600 dark:text-red-400' : ''}`}
    >
      {n === 0 ? '—' : fmtLedgerAed(n)}
    </td>
  );
}

function SummaryMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 bg-[var(--theme-surface)] px-3 py-2.5">
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-[var(--theme-text-muted)]">
        {label}
      </p>
      <p className="mt-0.5 truncate font-mono text-lg font-bold tabular-nums leading-none text-slate-900 dark:text-[var(--theme-text)]">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-[var(--theme-text-secondary)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export default function CustomerICFundsTab({
  slug,
  branchId,
  customer,
  icFundAccount: icFundAccountProp,
  branchName,
}: Props) {
  const [account, setAccount] = useState<ICFundAccount | null>(icFundAccountProp ?? null);
  const [statement, setStatement] = useState<{
    opening: number;
    lines: ICFundStatementLine[];
    closing: number;
  } | null>(null);
  const [loading, setLoading] = useState(!icFundAccountProp);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useApp();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let fundAccount = icFundAccountProp ?? null;
    if (!fundAccount) {
      fundAccount = await getICFundAccountByCustomerIdAction(branchId, customer.id);
    }
    if (!fundAccount) {
      setAccount(null);
      setStatement(null);
      setLoading(false);
      return;
    }
    setAccount(fundAccount);
    const result = await getCustomerICFundStatementAction({
      branchId,
      accountId: fundAccount.id,
      customerId: customer.id,
    });
    if (!result.success) {
      setError(result.error);
      setStatement(null);
      setLoading(false);
      return;
    }
    setStatement({
      opening: result.data.opening,
      lines: result.data.lines,
      closing: result.data.closing,
    });
    setLoading(false);
  }, [branchId, customer.id, icFundAccountProp]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (icFundAccountProp) setAccount(icFundAccountProp);
  }, [icFundAccountProp]);

  const statementView = useMemo(() => {
    if (!statement) return null;
    return buildCustomerStatementView(statement.lines, {
      customerCurrency: IC_FUNDS_BASE_CURRENCY,
      mode: 'aed',
      defaultFxRate: 1,
      openingAed: statement.opening,
      closingAed: statement.closing,
    });
  }, [statement]);

  const exportView = useMemo(() => {
    if (!statement) return null;
    return buildCustomerStatementView(statement.lines, {
      customerCurrency: IC_FUNDS_BASE_CURRENCY,
      mode: 'aed',
      defaultFxRate: 1,
      openingAed: statement.opening,
      closingAed: statement.closing,
      forCustomerExport: true,
    });
  }, [statement]);

  const handleExportCsv = () => {
    if (!exportView) return;
    const csv = buildCustomerStatementCsv(exportView, customer.name);
    downloadCustomerStatementCsv(csv, statementCsvFilename(customer.name, exportView.currency));
  };

  const handleExportPdf = () => {
    if (!exportView) return;
    const ok = printCustomerStatementPdf(exportView, customer.name, branchName);
    if (!ok) {
      showToast('Could not open print dialog. Try allowing pop-ups for this site.', 'error');
    }
  };

  if (loading) {
    return <ASICTableSkeleton framed={false} cols={6} rows={6} />;
  }

  if (!account) {
    return (
      <p className="py-8 text-center text-sm text-slate-400 dark:text-[var(--theme-text-muted)]">
        No IC Funds account linked to this customer yet.
      </p>
    );
  }

  const lines = statementView?.lines ?? [];
  const totalDr = lines.reduce((s, l) => s + (l.status === 'pending' ? 0 : l.debit), 0);
  const totalCr = lines.reduce((s, l) => s + (l.status === 'pending' ? 0 : l.credit), 0);

  const ledgerHint =
    account.balance > 0
      ? 'Receivable'
      : account.balance < 0
        ? 'Payable'
        : 'Settled';
  const pendingHint =
    account.pendingBalance && account.pendingBalance !== 0
      ? `${fmtLedgerAed(account.pendingBalance)} pending`
      : ledgerHint;
  const statementClosing =
    statementView != null ? fmtLedgerAed(statementView.closing) : '—';

  return (
    <div className="space-y-3">
      <section className={`${asicCard} overflow-hidden`} aria-label="IC Funds summary and tools">
        <div className="grid grid-cols-2 divide-x divide-y divide-[var(--theme-border-subtle)] sm:grid-cols-4">
          <SummaryMetric
            label="Ledger balance"
            value={fmtLedgerAed(account.balance)}
            hint={pendingHint}
          />
          <SummaryMetric label="Opening" value={fmtLedgerAed(account.openingBalance)} />
          <SummaryMetric
            label="Statement"
            value={statementClosing}
            hint="Company ledger"
          />
          <SummaryMetric
            label="Account"
            value={account.status.charAt(0).toUpperCase() + account.status.slice(1)}
            hint="IC Funds linked"
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--theme-border-subtle)] bg-[var(--theme-surface-raised)] px-3 py-2.5 dark:bg-[var(--theme-surface-muted)] sm:flex-row sm:items-center sm:justify-end">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={btnGhost}
              onClick={handleExportCsv}
              disabled={!exportView}
              title="Customer-facing CSV (profit lines excluded)"
            >
              CSV
            </button>
            <button
              type="button"
              className={btnSecondary}
              onClick={handleExportPdf}
              disabled={!exportView}
              title="Print or save as PDF"
            >
              PDF
            </button>
            <span className="hidden h-4 w-px bg-[var(--theme-border-subtle)] sm:inline" aria-hidden />
            <Link href={icFundsReportPath(slug, 'statement')} className={`${btnGhost} no-underline`}>
              Full report
            </Link>
            <Link href={`/${slug}/ic-funds/accounts`} className={`${asicBtnPrimary} no-underline`}>
              Open IC Funds
            </Link>
          </div>
        </div>
      </section>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {!statement || lines.length <= 1 ? (
        <p className="py-8 text-center text-sm text-slate-400 dark:text-[var(--theme-text-muted)]">
          No ledger entries for this account yet.
        </p>
      ) : (
        <div className={`${asicCard} ${asicTableWrap}`}>
          <table className={`${asicTable} min-w-[860px]`}>
            <thead>
              <tr className={asicTheadRow}>
                <th className={asicTh}>Date</th>
                <th className={asicTh}>#</th>
                <th className={asicTh}>Type</th>
                <th className={asicTh}>Particulars</th>
                <th className={asicThAlign('right')}>{icfLedgerColumnLabel.debit}</th>
                <th className={asicThAlign('right')}>{icfLedgerColumnLabel.credit}</th>
                <th className={asicThAlign('right')}>{icfLedgerColumnLabel.balance}</th>
                <th className={asicTh}>User</th>
                <th className={asicTh}>Remark</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr
                  key={`${line.voucherNo}-${i}`}
                  className={`${asicTr} ${line.internalOnly ? 'opacity-60' : ''} ${line.status === 'pending' ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}`}
                >
                  <td className={`${asicTd} tabular-nums text-slate-600 dark:text-[var(--theme-text-secondary)]`}>
                    {line.date ? fmtICDate(line.date) : '—'}
                  </td>
                  <td className={`${asicTd} font-mono tabular-nums text-slate-500`}>
                    {line.voucherNo || '—'}
                    {line.status === 'pending' ? (
                      <span className="ml-1 text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">
                        Pending
                      </span>
                    ) : null}
                    {line.internalOnly ? (
                      <span className="ml-1 text-[10px] font-semibold uppercase text-slate-400">Internal</span>
                    ) : null}
                  </td>
                  <td className={asicTd}>
                    {line.voucherNo === 0 ? 'OB' : IC_FUND_VOUCHER_LABELS[line.voucherType]}
                  </td>
                  <td className={`${asicTd} font-medium`}>
                    <StatementParticularsCell slug={slug} line={line} />
                  </td>
                  <AmountCell n={line.debit} />
                  <AmountCell n={line.credit} danger />
                  <td className={`${asicTd} text-right font-mono tabular-nums`}>
                    {fmtLedgerAed(line.balance)}
                  </td>
                  <td className={asicTd}>
                    <VoucherUserCell
                      voucher={{
                        createdByName: line.userName,
                        createdAt: line.userAt ?? '',
                      }}
                    />
                  </td>
                  <td className={`${asicTd} max-w-[12rem] truncate text-slate-500`}>
                    {line.notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--theme-border)] bg-slate-50/80 font-medium dark:bg-[var(--theme-surface-muted)]">
                <td className={asicTd} colSpan={4}>Totals</td>
                <td className={`${asicTd} text-right font-mono tabular-nums`}>
                  {fmtLedgerAed(totalDr)}
                </td>
                <td className={`${asicTd} text-right font-mono tabular-nums text-red-600 dark:text-red-400`}>
                  {fmtLedgerAed(totalCr)}
                </td>
                <td className={`${asicTd} text-right font-mono tabular-nums`}>
                  {statementView ? fmtLedgerAed(statementView.closing) : '—'}
                </td>
                <td className={asicTd} colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
