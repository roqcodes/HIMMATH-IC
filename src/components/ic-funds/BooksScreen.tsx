'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useICFundsReportHeaderToolbar } from '@/components/ic-funds/ICFundsReportsChrome';
import Link from 'next/link';
import {
  getICFundReportBundleAction,
  getICFundStatementAction,
  getICSettlementTradeReportAction,
  getICWarehousePLReportAction,
  listICFundAccountsLiteAction,
} from '@/app/actions/icFundsActions';
import { accountTypeLabel, IC_FUND_VOUCHER_LABELS } from '@/lib/icFunds/constants';
import { fmtICAmount, fmtICDate, fmtLedgerAed, icfLedgerColumnLabel } from '@/lib/icFunds/format';
import { formatReportPeriodCaption } from '@/lib/icFunds/reportCaptions';
import { downloadCsv, printReportArea } from '@/lib/icFunds/booksExport';
import { btnSecondary } from '@/lib/ui';
import TrialBalanceReport from '@/components/ic-funds/reports/TrialBalanceReport';
import ProfitLossReport from '@/components/ic-funds/reports/ProfitLossReport';
import BalanceSheetReport from '@/components/ic-funds/reports/BalanceSheetReport';
import DayBookReport from '@/components/ic-funds/reports/DayBookReport';
import CashBankBookReport from '@/components/ic-funds/reports/CashBankBookReport';
import SettlementTradeReport from '@/components/ic-funds/reports/SettlementTradeReport';
import { icFundsReportPath, type ICFundsReportId } from '@/lib/icFunds/nav';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import { computeBooksKpis } from '@/lib/icFunds/kpiMetrics';
import { icfCard, icfInput, icfLabel, icfTableWrap, icfTd, icfTh, icfThAlign, icfTheadRow, icfAccountLink } from '@/components/ic-funds/ui';
import { ASICTableRowsSkeleton, ASICTableSkeleton } from '@/components/asic/ASICTableSkeleton';
import ICFundsDateFilterBar from '@/components/ic-funds/ICFundsDateFilterBar';
import { useICFundsDateFilter } from '@/components/ic-funds/useICFundsDateFilter';
import VoucherUserCell from '@/components/ic-funds/VoucherUserCell';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import { BalanceWithPendingCell } from '@/components/ic-funds/BalanceWithPending';
import StatementParticularsCell from '@/components/ic-funds/StatementParticularsCell';
import { resolveAccountDetailHref } from '@/lib/icFunds/accountNavigation';
import { useApp } from '@/context/AppContext';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { logClientActionError } from '@/lib/errors/actionError';
import { trackLoading } from '@/lib/loadingBar';
import type { ICWarehousePLReport } from '@/lib/icFunds/warehouseProfit';
import type { ICSettlementTradeReport } from '@/lib/icFunds/settlementTradeReport';
import type { ICFundAccount, ICFundStatementLine, ICFundVoucher } from '@/types';

type ReportBundle = NonNullable<
  Extract<Awaited<ReturnType<typeof getICFundReportBundleAction>>, { success: true }>['data']
>;

function AmountCell({ n, danger }: { n: number; danger?: boolean }) {
  return (
    <td className={`${icfTd} text-right font-mono tabular-nums ${danger || n < 0 ? 'text-red-600' : ''}`}>
      {n === 0 ? '—' : fmtLedgerAed(n)}
    </td>
  );
}

export default function BooksScreen({
  branchId,
  slug,
  reportView,
  portal = 'branch',
}: {
  branchId: string;
  slug: string;
  reportView: ICFundsReportId;
  portal?: 'admin' | 'branch';
}) {
  const { branches } = useApp();
  const { alert, confirmDialog } = useConfirmDialog();
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
  } = useICFundsDateFilter(branch?.timezone, 'this-month');
  const [bundle, setBundle] = useState<ReportBundle | null>(null);
  const [warehousePl, setWarehousePl] = useState<ICWarehousePLReport | null>(null);
  const [settlementTradeReport, setSettlementTradeReport] = useState<ICSettlementTradeReport | null>(null);
  const [accounts, setAccounts] = useState<ICFundAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [statement, setStatement] = useState<{
    account: ICFundAccount;
    opening: number;
    lines: ICFundStatementLine[];
    closing: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const showLoadError = useCallback(
    async (scope: string, message: string) => {
      logClientActionError(scope, message);
      setError(message);
      await alert({
        title: 'Could not load report',
        message,
        variant: 'danger',
      });
    },
    [alert],
  );

  const loadWarehousePl = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await trackLoading(() => getICWarehousePLReportAction({ branchId, startDate, endDate }));
    if (!result.success) {
      await showLoadError('BooksScreen.loadWarehousePl', result.error);
      setWarehousePl(null);
    } else {
      setWarehousePl(result.data);
    }
    setLoading(false);
  }, [branchId, endDate, showLoadError, startDate]);

  const loadSettlementTradeReport = useCallback(async () => {
    const mode = reportView === 'metal-trades' ? 'metal' : 'cash';
    setLoading(true);
    setError(null);
    const result = await trackLoading(() =>
      getICSettlementTradeReportAction({ branchId, startDate, endDate, settlementMode: mode }),
    );
    if (!result.success) {
      await showLoadError('BooksScreen.loadSettlementTradeReport', result.error);
      setSettlementTradeReport(null);
    } else {
      setSettlementTradeReport(result.data);
    }
    setLoading(false);
  }, [branchId, endDate, reportView, showLoadError, startDate]);

  const loadBundle = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await trackLoading(() => getICFundReportBundleAction({ branchId, startDate, endDate }));
    if (!result.success) {
      await showLoadError('BooksScreen.loadBundle', result.error);
      setBundle(null);
    } else {
      setBundle(result.data);
    }
    setLoading(false);
  }, [branchId, endDate, showLoadError, startDate]);

  const loadStatement = useCallback(async () => {
    if (!accountId) {
      setStatement(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await trackLoading(() =>
      getICFundStatementAction({ branchId, accountId, startDate, endDate }),
    );
    if (!result.success) {
      await showLoadError('BooksScreen.loadStatement', result.error);
      setStatement(null);
    } else {
      setStatement(result.data);
    }
    setLoading(false);
  }, [accountId, branchId, endDate, showLoadError, startDate]);

  useEffect(() => {
    void trackLoading(() => listICFundAccountsLiteAction(branchId).then(setAccounts));
  }, [branchId]);

  useEffect(() => {
    if (reportView === 'statement') {
      void loadStatement();
      return;
    }
    if (reportView === 'warehouse-pl') {
      void loadWarehousePl();
      return;
    }
    if (reportView === 'fund-trades' || reportView === 'metal-trades') {
      void loadSettlementTradeReport();
      return;
    }
    void loadBundle();
  }, [loadBundle, loadStatement, loadSettlementTradeReport, loadWarehousePl, reportView]);

  const { periodLabel, asAtLabel } = formatReportPeriodCaption({
    startDate: bundle?.startDate ?? startDate,
    endDate: bundle?.endDate ?? endDate,
  });
  const asOfLabel = bundle?.asOfDate
    ? `As at ${fmtICDate(bundle.asOfDate)}`
    : asAtLabel;

  const booksKpiMetrics = useMemo(() => {
    if (reportView === 'statement') {
      if (!statement) return [];
    } else if (reportView === 'warehouse-pl') {
      if (!warehousePl) return [];
    } else if (reportView === 'fund-trades' || reportView === 'metal-trades') {
      if (!settlementTradeReport) return [];
    } else if (!bundle) {
      return [];
    }

    return computeBooksKpis({
      reportView,
      profitLoss: bundle?.profitLoss,
      plStatement: bundle?.plStatement,
      balanceSheet: bundle?.balanceSheet,
      trialBalance: bundle?.trialBalance,
      vouchers:
        reportView === 'd-expenses'
          ? bundle?.dExpenses
          : reportView === 'all-vouchers'
            ? bundle?.allVouchers
            : [],
      cashBank: bundle?.cashBank,
      receivables: bundle?.receivables,
      payables: bundle?.payables,
      warehousePl,
      settlementTradeReport,
      statement,
    });
  }, [reportView, bundle, warehousePl, settlementTradeReport, statement]);

  const ledgerById = useMemo(
    () => new Map((bundle?.accountLedgers ?? []).map(l => [l.accountId, l])),
    [bundle?.accountLedgers],
  );

  const handleExportCsv = useCallback(() => {
    if (reportView === 'fund-trades' || reportView === 'metal-trades') {
      if (!settlementTradeReport) return;
      const isMetal = settlementTradeReport.settlementMode === 'metal';
      const headers = isMetal
        ? [
            'Type',
            'Date',
            'Reference',
            'Counterparty',
            'Warehouse',
            'Fine weight (g)',
            'INR/g',
            'AED/g',
            'INR value',
            'Units',
            'Rate (AED)',
            'Amount (AED)',
            'P&L',
            'P&L currency',
            'Status',
          ]
        : ['Type', 'Date', 'Reference', 'Counterparty', 'Warehouse', 'Units', 'Rate (AED)', 'Amount (AED)', 'Status'];
      const rows = [...settlementTradeReport.purchases, ...settlementTradeReport.sales].map(r => {
        const status =
          r.txnKind === 'purchase' ? r.paymentStatus || r.paymentMethod || '' : r.orderStatus || r.paymentStatus || '';
        if (isMetal) {
          return [
            r.txnKind,
            r.date.slice(0, 10),
            r.reference,
            r.counterparty,
            r.warehouseName || '',
            r.metalWeightG ?? '',
            r.metalRateInrPerG ?? '',
            r.metalRateAedPerG ?? '',
            r.inrTotal ?? '',
            r.units,
            r.unitRateAed,
            r.aedTotal,
            r.bookedProfit ?? '',
            r.bookedCurrency ?? '',
            status,
          ];
        }
        return [
          r.txnKind,
          r.date.slice(0, 10),
          r.reference,
          r.counterparty,
          r.warehouseName || '',
          r.units,
          r.unitRateAed,
          r.aedTotal,
          status,
        ];
      });
      const name = reportView === 'metal-trades' ? 'metal-purchase-sales.csv' : 'fund-purchase-sales.csv';
      downloadCsv(name, headers, rows);
      return;
    }
    if (!bundle) return;
    if (reportView === 'trial-balance') {
      downloadCsv(
        'trial-balance.csv',
        ['Account', 'Type', 'Opening Dr', 'Opening Cr', 'Period Dr', 'Period Cr', 'Closing Dr', 'Closing Cr'],
        bundle.trialBalance.map(l => [
          l.accountName,
          l.accountType,
          l.openingDebit ?? 0,
          l.openingCredit ?? 0,
          l.periodDebit ?? 0,
          l.periodCredit ?? 0,
          l.closingDebit ?? l.debit,
          l.closingCredit ?? l.credit,
        ]),
      );
      return;
    }
    if (reportView === 'profit-loss' && bundle.plStatement) {
      const s = bundle.plStatement;
      downloadCsv('profit-and-loss.csv', ['Section', 'Amount (AED)'], [
        ['Sales / income', s.salesTotal],
        ['Direct costs', -s.directCostsTotal],
        ['Gross result', s.grossResult],
        ['Operating expenses', -s.operatingTotal],
        ['Net for period', s.netForPeriod],
      ]);
    }
  }, [bundle, reportView, settlementTradeReport]);

  const showCsvExport =
    ((reportView === 'trial-balance' || reportView === 'profit-loss') && Boolean(bundle)) ||
    ((reportView === 'fund-trades' || reportView === 'metal-trades') && Boolean(settlementTradeReport));

  const headerToolbar = useMemo(
    () => (
      <>
        <button type="button" className={btnSecondary} onClick={() => printReportArea('icf-report-print')}>
          Print
        </button>
        {showCsvExport ? (
          <button type="button" className={btnSecondary} onClick={handleExportCsv}>
            Export CSV
          </button>
        ) : null}
      </>
    ),
    [showCsvExport, handleExportCsv],
  );

  useICFundsReportHeaderToolbar(headerToolbar);

  const accountTable = (rows: ICFundAccount[], empty: string, showAsOf = false) => (
    <div>
      {showAsOf ? (
        <p className="border-b border-slate-200 px-2.5 py-1 text-[11px] text-slate-500">{asOfLabel}</p>
      ) : null}
    <div className={icfTableWrap}>
      <table className="w-full min-w-[520px] text-left">
        <thead>
          <tr className={icfTheadRow}>
            <th className={icfTh}>Account</th>
            <th className={icfTh}>Type</th>
            <th className={icfThAlign('right')}>{icfLedgerColumnLabel.opening}</th>
            <th className={icfThAlign('right')}>{icfLedgerColumnLabel.balance}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={4} className={`${icfTd} py-6 text-center text-slate-500`}>{empty}</td></tr>
          ) : (
            rows.map(row => (
              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className={icfTd}>
                  <Link href={resolveAccountDetailHref(row.branchSlug || slug, row)} className={icfAccountLink}>
                    {row.name}
                  </Link>
                </td>
                <td className={`${icfTd} text-slate-500`}>{accountTypeLabel(row.accountType)}</td>
                <AmountCell n={ledgerById.get(row.id)?.opening ?? row.openingBalance} />
                <BalanceWithPendingCell balance={row.balance} pendingBalance={row.pendingBalance} />
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
    </div>
  );

  const voucherTable = (rows: ICFundVoucher[], empty: string) => (
    <div className={icfTableWrap}>
      <table className="w-full min-w-[680px] text-left">
        <thead>
          <tr className={icfTheadRow}>
            <th className={icfTh}>#</th>
            <th className={icfTh}>Date</th>
            <th className={icfTh}>Type</th>
            <th className={icfTh}>Debit</th>
            <th className={icfTh}>Credit</th>
            <th className={icfThAlign('right')}>{icfLedgerColumnLabel.amount}</th>
            <th className={icfTh}>User</th>
            <th className={icfTh}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={8} className={`${icfTd} py-6 text-center text-slate-500`}>{empty}</td></tr>
          ) : (
            rows.map(row => (
              <tr key={row.id} className={`border-b border-slate-100 hover:bg-slate-50 ${row.status === 'void' ? 'bg-slate-50/80 text-slate-400' : row.status === 'pending' ? 'bg-amber-50/40 text-slate-600' : ''}`}>
                <td className={`${icfTd} font-mono tabular-nums text-slate-500`}>
                  {row.voucherNo}
                  {row.status === 'void' ? <span className="ml-1 text-[10px] font-semibold uppercase text-red-500">VOID</span> : null}
                  {row.status === 'pending' ? <span className="ml-1 text-[10px] font-semibold uppercase text-amber-600">PENDING</span> : null}
                </td>
                <td className={`${icfTd} tabular-nums`}>{fmtICDate(row.voucherDate)}</td>
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
                <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtLedgerAed(row.amount)}</td>
                <td className={icfTd}><VoucherUserCell voucher={row} /></td>
                <td className={`${icfTd} max-w-[12rem] truncate text-slate-500`}>{row.notes || '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const totalDr = statement?.lines.reduce((s, l) => s + (l.status === 'pending' ? 0 : l.debit), 0) ?? 0;
  const totalCr = statement?.lines.reduce((s, l) => s + (l.status === 'pending' ? 0 : l.credit), 0) ?? 0;

  return (
    <div>
      {confirmDialog}
      <div className={`${icfCard} min-w-0`}>
        <div className="border-b border-slate-200 px-3 pt-2 dark:border-[var(--theme-border)]">
          <div className="flex flex-wrap items-center gap-3 pb-2">
            {reportView === 'statement' ? (
              <div className="min-w-[12rem]">
                <label className={icfLabel} htmlFor="icf-stmt-acc">Account</label>
                <select id="icf-stmt-acc" className={icfInput} value={accountId} onChange={e => setAccountId(e.target.value)}>
                  <option value="">Select account</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} · {accountTypeLabel(a.accountType)}</option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <ICFundsDateFilterBar
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            customStartDate={customStartDate}
            setCustomStartDate={setCustomStartDate}
            customEndDate={customEndDate}
            setCustomEndDate={setCustomEndDate}
          />
        </div>

        {booksKpiMetrics.length > 0 ? <AsicKpiStrip metrics={booksKpiMetrics} className="mx-3 mb-2" /> : null}

        {error ? <p className="px-3 py-2 text-sm text-red-600">{error}</p> : null}
        <div id="icf-report-print">
        {loading && reportView !== 'statement' && reportView !== 'warehouse-pl' && !bundle ? (
          <ASICTableSkeleton framed={false} cols={7} rows={8} />
        ) : null}
        {loading && reportView === 'warehouse-pl' && !warehousePl ? (
          <ASICTableSkeleton framed={false} cols={9} rows={8} />
        ) : null}
        {loading && (reportView === 'fund-trades' || reportView === 'metal-trades') && !settlementTradeReport ? (
          <ASICTableSkeleton framed={false} cols={10} rows={10} />
        ) : null}

        {reportView === 'statement' ? (
          !accountId ? (
            <p className={`${icfTd} py-8 text-center text-slate-500`}>Choose an account to load its statement.</p>
          ) : (
            <div className={icfTableWrap}>
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className={icfTheadRow}>
                    <th className={icfTh}>Date</th>
                    <th className={icfTh}>#</th>
                    <th className={icfTh}>Type</th>
                    <th className={icfTh}>Particulars</th>
                    <th className={icfThAlign('right')}>{icfLedgerColumnLabel.debit}</th>
                    <th className={icfThAlign('right')}>{icfLedgerColumnLabel.credit}</th>
                    <th className={icfThAlign('right')}>{icfLedgerColumnLabel.balance}</th>
                    <th className={icfTh}>User</th>
                    <th className={icfTh}>Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <ASICTableRowsSkeleton rows={8} cols={9} />
                  ) : (
                    statement?.lines.map((line, i) => (
                      <tr
                        key={`${line.voucherNo}-${i}`}
                        className={`border-b border-slate-100 hover:bg-slate-50 ${line.status === 'pending' ? 'bg-amber-50/40' : ''}`}
                      >
                        <td className={`${icfTd} tabular-nums`}>{line.date ? fmtICDate(line.date) : '—'}</td>
                        <td className={`${icfTd} font-mono tabular-nums text-slate-500`}>
                          {line.voucherNo || '—'}
                          {line.status === 'pending' ? (
                            <span className="ml-1 text-[10px] font-semibold uppercase text-amber-600">PENDING</span>
                          ) : null}
                        </td>
                        <td className={icfTd}>{line.voucherNo === 0 ? 'OB' : IC_FUND_VOUCHER_LABELS[line.voucherType]}</td>
                        <td className={`${icfTd} font-medium`}>
                          <StatementParticularsCell slug={slug} line={line} accounts={accounts} />
                        </td>
                        <AmountCell n={line.debit} />
                        <AmountCell n={line.credit} danger />
                        <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtLedgerAed(line.balance)}</td>
                        <td className={icfTd}>
                          <VoucherUserCell
                            voucher={{
                              createdByName: line.userName,
                              createdAt: line.userAt ?? '',
                            }}
                          />
                        </td>
                        <td className={`${icfTd} max-w-[12rem] truncate text-slate-500`}>{line.notes || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {statement ? (
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50 font-medium">
                      <td className={icfTd} colSpan={4}>Totals</td>
                      <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtLedgerAed(totalDr)}</td>
                      <td className={`${icfTd} text-right font-mono tabular-nums text-red-600`}>{fmtLedgerAed(totalCr)}</td>
                      <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtLedgerAed(statement.closing)}</td>
                      <td className={icfTd} />
                      <td className={icfTd} />
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          )
        ) : null}

        {bundle && reportView === 'all-vouchers' ? (
          <DayBookReport
            vouchers={bundle.allVouchers}
            slug={slug}
            accounts={accounts}
            periodLabel={periodLabel}
            truncated={bundle.dayBookTruncated}
          />
        ) : null}
        {bundle && reportView === 'cash-bank' ? (
          <CashBankBookReport
            ledgers={bundle.accountLedgers}
            slug={slug}
            accounts={accounts}
            asAtLabel={asOfLabel}
            periodLabel={periodLabel}
          />
        ) : null}
        {bundle && reportView === 'd-expenses' ? voucherTable(bundle.dExpenses, 'No direct expenses in this period.') : null}
        {bundle && reportView === 'receivables' ? (
          <div className="grid sm:grid-cols-2">
            <p className="border-b border-slate-200 px-2.5 py-1 text-[11px] text-slate-500 sm:col-span-2">{asOfLabel}</p>
            <div className="border-b border-slate-200 sm:border-b-0 sm:border-r">
              <p className="border-b border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-500">Receivables</p>
              {accountTable(bundle.receivables, 'No receivable personal balances (posted or pending).')}
            </div>
            <div>
              <p className="border-b border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-500">Payables</p>
              {accountTable(bundle.payables, 'No payable personal balances (posted or pending).')}
            </div>
          </div>
        ) : null}
        {bundle && reportView === 'profit-loss' && bundle.plStatement ? (
          <ProfitLossReport
            statement={bundle.plStatement}
            periodLabel={periodLabel}
            slug={slug}
            accounts={accounts}
          />
        ) : null}
        {warehousePl && reportView === 'warehouse-pl' ? (
          <div>
            <p className="border-b border-slate-200 px-2.5 py-1 text-[11px] text-slate-500">
              IC (cash) gross profit uses weighted-average AED cost on remaining unit stock. Metal P&amp;L is sale
              AED minus purchase AED on the matched lot (grams pro-rata).
            </p>
            <div className={icfTableWrap}>
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className={icfTheadRow}>
                    <th className={icfTh}>Warehouse</th>
                    <th className={icfThAlign('right')}>Stock u</th>
                    <th className={icfThAlign('right')}>{icfLedgerColumnLabel.avgCost}</th>
                    <th className={icfThAlign('right')}>Sold u</th>
                    <th className={icfThAlign('right')}>{icfLedgerColumnLabel.revenue}</th>
                    <th className={icfThAlign('right')}>{icfLedgerColumnLabel.cogs}</th>
                    <th className={icfThAlign('right')}>{icfLedgerColumnLabel.grossProfit}</th>
                    <th className={icfThAlign('right')}>Metal P&amp;L</th>
                  </tr>
                </thead>
                <tbody>
                  {warehousePl.warehouses.length === 0 ? (
                    <tr>
                      <td className={`${icfTd} py-6 text-center text-slate-500`} colSpan={8}>
                        No completed warehouse sales in this period.
                      </td>
                    </tr>
                  ) : (
                    warehousePl.warehouses.map(row => (
                      <tr key={row.warehouseId} className="border-b border-slate-100">
                        <td className={`${icfTd} font-medium`}>{row.warehouseName}</td>
                        <td className={`${icfTd} text-right font-mono tabular-nums`}>
                          {row.purchaseUnits.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </td>
                        <td className={`${icfTd} text-right font-mono tabular-nums`}>
                          {row.weightedAvgRate > 0 ? `${fmtICAmount(row.weightedAvgRate)} AED` : '—'}
                        </td>
                        <td className={`${icfTd} text-right font-mono tabular-nums`}>
                          {row.saleUnits.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </td>
                        <AmountCell n={row.revenue} />
                        <AmountCell n={row.cogs} />
                        <AmountCell n={row.grossProfit} danger={row.grossProfit < 0} />
                        <AmountCell n={row.metalProfitAed} danger={row.metalProfitAed < 0} />
                      </tr>
                    ))
                  )}
                </tbody>
                {warehousePl.warehouses.length > 0 ? (
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50 font-medium">
                      <td className={icfTd}>Totals</td>
                      <td className={icfTd} />
                      <td className={icfTd} />
                      <td className={`${icfTd} text-right font-mono tabular-nums`}>
                        {warehousePl.totals.saleUnits.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </td>
                      <AmountCell n={warehousePl.totals.revenue} />
                      <AmountCell n={warehousePl.totals.cogs} />
                      <AmountCell n={warehousePl.totals.grossProfit} danger={warehousePl.totals.grossProfit < 0} />
                      <AmountCell n={warehousePl.totals.metalProfitAed} danger={warehousePl.totals.metalProfitAed < 0} />
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
            <p className="border-b border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-500">
              Sale detail
            </p>
            <div className={icfTableWrap}>
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr className={icfTheadRow}>
                    <th className={icfTh}>Date</th>
                    <th className={icfTh}>Warehouse</th>
                    <th className={icfTh}>Customer</th>
                    <th className={icfTh}>Deal</th>
                    <th className={icfThAlign('right')}>Units / g</th>
                    <th className={icfThAlign('right')}>{icfLedgerColumnLabel.saleRate}</th>
                    <th className={icfThAlign('right')}>{icfLedgerColumnLabel.avgCost}</th>
                    <th className={icfThAlign('right')}>Revenue</th>
                    <th className={icfThAlign('right')}>COGS</th>
                    <th className={icfThAlign('right')}>{icfLedgerColumnLabel.profit}</th>
                  </tr>
                </thead>
                <tbody>
                  {warehousePl.lines.length === 0 ? (
                    <tr>
                      <td className={`${icfTd} py-6 text-center text-slate-500`} colSpan={10}>
                        No completed sales in this period.
                      </td>
                    </tr>
                  ) : (
                    warehousePl.lines.map(line => (
                      <tr key={line.saleId} className="border-b border-slate-100">
                        <td className={icfTd}>{fmtICDate(line.saleDate)}</td>
                        <td className={icfTd}>{line.warehouseName}</td>
                        <td className={`${icfTd} max-w-[10rem] truncate`}>{line.customerName}</td>
                        <td className={icfTd}>
                          {line.settlementMode === 'metal' ? 'Metal' : 'IC cash'}
                        </td>
                        <td className={`${icfTd} text-right font-mono tabular-nums`}>
                          {line.settlementMode === 'metal'
                            ? `${(line.metalWeightG ?? line.units).toLocaleString(undefined, { maximumFractionDigits: 4 })} g`
                            : line.units.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </td>
                        <td className={`${icfTd} text-right font-mono tabular-nums`}>
                          {line.settlementMode === 'metal' || line.saleRate === 0
                            ? '—'
                            : `${fmtICAmount(line.saleRate)} AED`}
                        </td>
                        <td className={`${icfTd} text-right font-mono tabular-nums`}>
                          {line.avgPurchaseRate > 0 ? `${fmtICAmount(line.avgPurchaseRate)} AED` : '—'}
                        </td>
                        <AmountCell n={line.revenue} />
                        <AmountCell n={line.cogs} />
                        <td className={`${icfTd} text-right font-mono tabular-nums ${line.grossProfit < 0 ? 'text-red-600' : ''}`}>
                          {fmtLedgerAed(line.grossProfit)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {settlementTradeReport && (reportView === 'fund-trades' || reportView === 'metal-trades') ? (
          <SettlementTradeReport report={settlementTradeReport} periodLabel={periodLabel} />
        ) : null}
        {bundle && reportView === 'balance-sheet' && bundle.balanceSheetDetail ? (
          <BalanceSheetReport
            detail={bundle.balanceSheetDetail}
            asAtLabel={asOfLabel}
            balanced={bundle.balanceSheet.balanced}
            outOfBalance={bundle.balanceSheet.outOfBalance}
            slug={slug}
            accounts={accounts}
          />
        ) : null}
        {bundle && reportView === 'trial-balance' ? (
          <TrialBalanceReport
            lines={bundle.trialBalance}
            slug={slug}
            accounts={accounts}
            asAtLabel={asOfLabel}
          />
        ) : null}
        </div>
      </div>
    </div>
  );
}
