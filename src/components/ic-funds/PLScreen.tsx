'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getICFundReportBundleAction } from '@/app/actions/icFundsActions';
import {
  accountTypeLabel,
  IC_FUND_VOUCHER_LABELS,
  isPLAccountType,
} from '@/lib/icFunds/constants';
import { fmtICAmount, fmtICDate, fmtLedgerAed, icfLedgerColumnLabel } from '@/lib/icFunds/format';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import { computePlKpis } from '@/lib/icFunds/kpiMetrics';
import { icfCard, icfInput, icfLabel, icfTableWrap, icfTd, icfTh, icfThAlign, icfTheadRow, icfAccountLink } from '@/components/ic-funds/ui';
import { ASICPageSkeleton, ASICTableRowsSkeleton, ASICTableSkeleton } from '@/components/asic/ASICTableSkeleton';
import ICFundsDateFilterBar from '@/components/ic-funds/ICFundsDateFilterBar';
import { useICFundsDateFilter } from '@/components/ic-funds/useICFundsDateFilter';
import VoucherUserCell from '@/components/ic-funds/VoucherUserCell';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import { BalanceWithPendingCell } from '@/components/ic-funds/BalanceWithPending';
import { plDisplayBalance, plPeriodMovement } from '@/lib/icFunds/accountBalance';
import { resolveAccountDetailHref } from '@/lib/icFunds/accountNavigation';
import { useApp } from '@/context/AppContext';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { logClientActionError } from '@/lib/errors/actionError';
import { trackLoading } from '@/lib/loadingBar';
import type { ICFundAccount, ICFundAccountType, ICFundVoucher } from '@/types';

type ReportBundle = NonNullable<
  Extract<Awaited<ReturnType<typeof getICFundReportBundleAction>>, { success: true }>['data']
>;

const PL_TYPE_ORDER: ICFundAccountType[] = ['income', 'profit', 'expense', 'd_expense'];

function AmountCell({ n, danger }: { n: number; danger?: boolean }) {
  return (
    <td className={`${icfTd} text-right font-mono tabular-nums ${danger || n < 0 ? 'text-red-600' : ''}`}>
      {n === 0 ? '—' : fmtLedgerAed(n)}
    </td>
  );
}

function touchesPLAccount(voucher: ICFundVoucher, accountId?: string): boolean {
  if (!isPLAccountType(voucher.debitAccountType) && !isPLAccountType(voucher.creditAccountType)) {
    return false;
  }
  if (!accountId) return true;
  return voucher.debitAccountId === accountId || voucher.creditAccountId === accountId;
}

function plAccountLabel(voucher: ICFundVoucher): string {
  const parts: string[] = [];
  if (isPLAccountType(voucher.debitAccountType)) parts.push(voucher.debitAccountName);
  if (isPLAccountType(voucher.creditAccountType) && voucher.creditAccountName !== voucher.debitAccountName) {
    parts.push(voucher.creditAccountName);
  }
  return parts.join(' / ') || '—';
}

export default function PLScreen({
  branchId,
  slug,
}: {
  branchId: string;
  slug: string;
  portal?: 'admin' | 'branch';
}) {
  const { branches } = useApp();
  const { alert } = useConfirmDialog();
  const branch = branches.find(b => b.slug === slug);
  const {
    dateFilter,
    setDateFilter,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    startDate,
    endDate,
  } = useICFundsDateFilter(branch?.timezone);

  const [bundle, setBundle] = useState<ReportBundle | null>(null);
  const [accountFilter, setAccountFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await trackLoading(() => getICFundReportBundleAction({ branchId, startDate, endDate }));
    if (!result.success) {
      logClientActionError('PLScreen.load', result.error);
      setError(result.error);
      setBundle(null);
      await alert({
        title: 'Could not load P&L',
        message: result.error,
        variant: 'danger',
      });
    } else {
      setBundle(result.data);
    }
    setLoading(false);
  }, [alert, branchId, endDate, startDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const plAccounts = useMemo(() => {
    if (!bundle) return [];
    return bundle.accounts
      .filter(a => isPLAccountType(a.accountType))
      .sort(
        (a, b) =>
          PL_TYPE_ORDER.indexOf(a.accountType) - PL_TYPE_ORDER.indexOf(b.accountType) ||
          a.name.localeCompare(b.name),
      );
  }, [bundle]);

  const plVouchers = useMemo(() => {
    if (!bundle) return [];
    return bundle.allVouchers
      .filter(v => touchesPLAccount(v, accountFilter || undefined))
      .sort((a, b) => {
        const dateCmp = a.voucherDate.localeCompare(b.voucherDate);
        if (dateCmp !== 0) return dateCmp;
        return a.voucherNo - b.voucherNo;
      });
  }, [accountFilter, bundle]);

  const summary = bundle?.profitLoss;
  const plKpiMetrics = useMemo(
    () => (summary ? computePlKpis(summary, plVouchers.length) : []),
    [summary, plVouchers.length],
  );

  return (
    <div className="space-y-4">
      <ICFundsDateFilterBar
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      {loading && !bundle ? (
        <ASICPageSkeleton />
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : bundle ? (
        <>
          {plKpiMetrics.length > 0 ? <AsicKpiStrip metrics={plKpiMetrics} /> : null}

          <div className={icfCard}>
            <div className="border-b border-slate-200 px-2.5 py-2">
              <h3 className="text-sm font-semibold text-slate-900">Profit & loss accounts</h3>
              <p className="text-[11px] text-slate-500">
                Period activity with signed P&L amounts — income and profit positive, expenses
                negative.
              </p>
            </div>
            <div className={icfTableWrap}>
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className={icfTheadRow}>
                    <th className={icfTh}>Account</th>
                    <th className={icfTh}>Type</th>
                    <th className={icfThAlign('right')}>{icfLedgerColumnLabel.opening}</th>
                    <th className={icfThAlign('right')}>{icfLedgerColumnLabel.period}</th>
                  </tr>
                </thead>
                <tbody>
                  {plAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className={`${icfTd} py-6 text-center text-slate-500`}>
                        No profit or loss accounts yet.
                      </td>
                    </tr>
                  ) : (
                    plAccounts.map(row => (
                      <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className={icfTd}>
                          <Link
                            href={resolveAccountDetailHref(row.branchSlug || slug, row)}
                            className={icfAccountLink}
                          >
                            {row.name}
                          </Link>
                        </td>
                        <td className={`${icfTd} text-slate-500`}>{accountTypeLabel(row.accountType)}</td>
                        <AmountCell n={plDisplayBalance(row.accountType, row.openingBalance)} />
                        <BalanceWithPendingCell
                          balance={plPeriodMovement(row.id, row.accountType, bundle.allVouchers)}
                          pendingBalance={plDisplayBalance(row.accountType, row.pendingBalance ?? 0)}
                        />
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={icfCard}>
            <div className="flex flex-col gap-3 border-b border-slate-200 px-2.5 py-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Ledger entries</h3>
                <p className="text-[11px] text-slate-500">
                  Vouchers touching P&L accounts in the selected period.
                </p>
              </div>
              <div className="min-w-[200px]">
                <label className={icfLabel} htmlFor="pl-account-filter">
                  Filter account
                </label>
                <select
                  id="pl-account-filter"
                  className={icfInput}
                  value={accountFilter}
                  onChange={e => setAccountFilter(e.target.value)}
                >
                  <option value="">All P&L accounts</option>
                  {plAccounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({accountTypeLabel(account.accountType)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={icfTableWrap}>
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className={icfTheadRow}>
                    <th className={icfTh}>Date</th>
                    <th className={icfTh}>#</th>
                    <th className={icfTh}>Type</th>
                    <th className={icfTh}>P&L account</th>
                    <th className={icfTh}>Debit</th>
                    <th className={icfTh}>Credit</th>
                    <th className={icfThAlign('right')}>{icfLedgerColumnLabel.amount}</th>
                    <th className={icfTh}>User</th>
                    <th className={icfTh}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <ASICTableRowsSkeleton rows={8} cols={9} />
                  ) : plVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className={`${icfTd} py-6 text-center text-slate-500`}>
                        No P&L entries in this period.
                      </td>
                    </tr>
                  ) : (
                    plVouchers.map(row => (
                      <tr
                        key={row.id}
                        className={`border-b border-slate-100 hover:bg-slate-50 ${
                          row.status === 'void'
                            ? 'bg-slate-50/80 text-slate-400'
                            : row.status === 'pending'
                              ? 'bg-amber-50/40 text-slate-600'
                              : ''
                        }`}
                      >
                        <td className={`${icfTd} tabular-nums`}>{fmtICDate(row.voucherDate)}</td>
                        <td className={`${icfTd} font-mono tabular-nums text-slate-500`}>
                          {row.voucherNo}
                          {row.status === 'void' ? (
                            <span className="ml-1 text-[10px] font-semibold uppercase text-red-500">VOID</span>
                          ) : null}
                          {row.status === 'pending' ? (
                            <span className="ml-1 text-[10px] font-semibold uppercase text-amber-600">PENDING</span>
                          ) : null}
                        </td>
                        <td className={icfTd}>{IC_FUND_VOUCHER_LABELS[row.voucherType]}</td>
                        <td className={icfTd}>{plAccountLabel(row)}</td>
                        <td className={icfTd}>
                          <ICFundAccountLink
                            slug={slug}
                            accountId={row.debitAccountId}
                            name={row.debitAccountName}
                            accounts={bundle.accounts}
                          />
                        </td>
                        <td className={icfTd}>
                          <ICFundAccountLink
                            slug={slug}
                            accountId={row.creditAccountId}
                            name={row.creditAccountName}
                            accounts={bundle.accounts}
                          />
                        </td>
                        <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtLedgerAed(row.amount)}</td>
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
        </>
      ) : (
        <ASICTableSkeleton />
      )}
    </div>
  );
}
