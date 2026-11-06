'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useICFundsReportHeaderToolbar } from '@/components/ic-funds/ICFundsReportsChrome';
import Link from 'next/link';
import {
  getICFundReportBundleAction,
  getICFundStatementAction,
  getInrFundStatementAction,
  getICSettlementTradeReportAction,
  getICWarehousePLReportAction,
  listICFundAccountsLiteAction,
  resolveInrFundAccountIdForIcFundAccountAction,
} from '@/app/actions/icFundsActions';
import { accountTypeLabel, IC_FUND_VOUCHER_LABELS } from '@/lib/icFunds/constants';
import {
  fmtICDate,
  icfLedgerColumnLabel,
  icfLedgerColumnLabelFor,
  FmtLedgerAed,
  FmtLedgerAmount,
} from '@/lib/icFunds/format';
import { formatReportPeriodCaption } from '@/lib/icFunds/reportCaptions';
import { downloadCsv, exportReportPdfFromElement, openReportPreviewNewTab } from '@/lib/icFunds/booksExport';
import { reportCatalogTitle } from '@/lib/icFunds/reportCatalog';
import {
  DEFAULT_REPORT_FILTERS,
  filterAccounts,
  filterSettlementTradeReport,
  filterStatementLines,
  filterTrialBalanceLines,
  filterVouchers,
  filterWarehousePlLines,
  filterWarehouseSummaries,
  formatReportFilterSummary,
  type ReportFilterState,
} from '@/lib/icFunds/reportFilters';
import { buildSupplierSearchOptions, buildWarehouseSearchOptions } from '@/lib/icTransfer/entitySearchOptions';
import type { EntitySearchOption } from '@/lib/icTransfer/entitySearchOptions';
import FinancialReportFilterPanel from '@/components/ic-funds/reports/FinancialReportFilterPanel';
import WarehouseStatementReport from '@/components/ic-funds/reports/WarehouseStatementReport';
import { btnSecondary } from '@/lib/ui';
import TrialBalanceReport from '@/components/ic-funds/reports/TrialBalanceReport';
import ProfitLossReport from '@/components/ic-funds/reports/ProfitLossReport';
import BalanceSheetReport from '@/components/ic-funds/reports/BalanceSheetReport';
import DayBookReport from '@/components/ic-funds/reports/DayBookReport';
import CashBankBookReport from '@/components/ic-funds/reports/CashBankBookReport';
import SettlementTradeReport from '@/components/ic-funds/reports/SettlementTradeReport';
import { type ICFundsReportId } from '@/lib/icFunds/nav';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import { computeBooksKpis } from '@/lib/icFunds/kpiMetrics';
import { icfCard, icfTableWrap, icfTd, icfTh, icfThAlign, icfTheadRow, icfAccountLink } from '@/components/ic-funds/ui';
import { ASICTableRowsSkeleton, ASICTableSkeleton } from '@/components/asic/ASICTableSkeleton';
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
import {
  sliceSettlementTradeReport,
  type ICSettlementTradeReport,
} from '@/lib/icFunds/settlementTradeReport';
import { AED_LEDGER_CAPTION, ReportCaption } from '@/components/ic-funds/reports/reportShared';
import type { ICFundAccount, ICFundStatementLine, ICFundVoucher } from '@/types';

type ReportBundle = NonNullable<
  Extract<Awaited<ReturnType<typeof getICFundReportBundleAction>>, { success: true }>['data']
>;

function AmountCell({
  n,
  danger,
  currency = 'AED',
}: {
  n: number;
  danger?: boolean;
  currency?: 'AED' | 'INR';
}) {
  return (
    <td className={`${icfTd} text-right font-mono tabular-nums ${danger || n < 0 ? 'text-red-600' : ''}`}>
      {n === 0 ? '—' : <FmtLedgerAmount amount={n} book={currency} />}
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
  const { branches, icSuppliers, icWarehouses, icPurchases, icSales } = useApp();
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
  const [reportFilters, setReportFilters] = useState<ReportFilterState>(DEFAULT_REPORT_FILTERS);
  const [statementBook, setStatementBook] = useState<'aed' | 'inr'>('aed');
  const [plBook, setPlBook] = useState<'aed' | 'inr'>('aed');
  const [metalBook, setMetalBook] = useState<'inr' | 'aed'>('inr');
  const [warehouseBook, setWarehouseBook] = useState<'ic' | 'metal'>('ic');
  const [inrAccountId, setInrAccountId] = useState<string | null>(null);
  const [inrStatement, setInrStatement] = useState<{
    opening: number;
    closing: number;
    lines: ICFundStatementLine[];
    accountName: string;
  } | null>(null);

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
      getICSettlementTradeReportAction({
        branchId,
        startDate,
        endDate,
        settlementMode: mode,
        includeVoidOrders: reportFilters.includeVoidOrders,
      }),
    );
    if (!result.success) {
      await showLoadError('BooksScreen.loadSettlementTradeReport', result.error);
      setSettlementTradeReport(null);
    } else {
      setSettlementTradeReport(result.data);
    }
    setLoading(false);
  }, [branchId, endDate, reportView, reportFilters.includeVoidOrders, showLoadError, startDate]);

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
    setPlBook('aed');
    setMetalBook('inr');
    setWarehouseBook('ic');
  }, [reportView]);

  useEffect(() => {
    if (reportView === 'statement') {
      void loadStatement();
      return;
    }
    if (reportView === 'warehouse-pl' || reportView === 'profit-loss') {
      void loadWarehousePl();
      if (reportView === 'warehouse-pl') return;
    }
    if (reportView === 'fund-trades' || reportView === 'metal-trades') {
      void loadSettlementTradeReport();
      return;
    }
    void loadBundle();
  }, [loadBundle, loadStatement, loadSettlementTradeReport, loadWarehousePl, reportView]);

  useEffect(() => {
    if (!accountId) {
      setInrAccountId(null);
      setInrStatement(null);
      return;
    }
    void resolveInrFundAccountIdForIcFundAccountAction({ branchId, icFundAccountId: accountId }).then(result => {
      if (result.success && result.data.inrAccountId) {
        setInrAccountId(result.data.inrAccountId);
      } else {
        setInrAccountId(null);
        setStatementBook('aed');
      }
    });
  }, [accountId, branchId]);

  useEffect(() => {
    if (reportView !== 'statement' || statementBook !== 'inr' || !inrAccountId) {
      setInrStatement(null);
      return;
    }
    setLoading(true);
    void trackLoading(() =>
      getInrFundStatementAction({ branchId, accountId: inrAccountId, startDate, endDate }).then(result => {
        if (!result.success) {
          void showLoadError('BooksScreen.loadInrStatement', result.error);
          setInrStatement(null);
        } else {
          setInrStatement({
            opening: result.data.opening,
            closing: result.data.closing,
            lines: result.data.lines,
            accountName: result.data.account.name,
          });
        }
        setLoading(false);
      }),
    );
  }, [branchId, endDate, inrAccountId, reportView, showLoadError, startDate, statementBook]);

  const { periodLabel, asAtLabel } = formatReportPeriodCaption({
    startDate: bundle?.startDate ?? startDate,
    endDate: bundle?.endDate ?? endDate,
  });
  const asOfLabel = bundle?.asOfDate
    ? `As at ${fmtICDate(bundle.asOfDate)}`
    : asAtLabel;

  const ledgerById = useMemo(
    () => new Map((bundle?.accountLedgers ?? []).map(l => [l.accountId, l])),
    [bundle?.accountLedgers],
  );

  const accountSearchOptions: EntitySearchOption[] = useMemo(
    () =>
      accounts.map(a => ({
        value: a.id,
        label: a.name,
        detail: accountTypeLabel(a.accountType),
      })),
    [accounts],
  );

  const warehouseSearchOptions = useMemo(
    () => buildWarehouseSearchOptions(icWarehouses, icSales, undefined, undefined, icPurchases),
    [icPurchases, icSales, icWarehouses],
  );

  const counterpartySearchOptions = useMemo(
    () => buildSupplierSearchOptions(icSuppliers),
    [icSuppliers],
  );

  const filteredSettlementReport = useMemo(
    () => (settlementTradeReport ? filterSettlementTradeReport(settlementTradeReport, reportFilters) : null),
    [reportFilters, settlementTradeReport],
  );

  const displayedSettlementReport = useMemo(() => {
    if (!filteredSettlementReport) return null;
    if (reportView !== 'metal-trades') return filteredSettlementReport;
    return sliceSettlementTradeReport(filteredSettlementReport, metalBook);
  }, [filteredSettlementReport, metalBook, reportView]);

  const filteredWarehouseSummaries = useMemo(
    () =>
      warehousePl
        ? filterWarehouseSummaries(warehousePl.warehouses, reportFilters.warehouseId, reportFilters.search)
        : [],
    [reportFilters.search, reportFilters.warehouseId, warehousePl],
  );

  const filteredWarehouseLines = useMemo(
    () =>
      warehousePl
        ? filterWarehousePlLines(warehousePl.lines, reportFilters.warehouseId, reportFilters.search)
        : [],
    [reportFilters.search, reportFilters.warehouseId, warehousePl],
  );

  const filteredAllVouchers = useMemo(
    () => (bundle ? filterVouchers(bundle.allVouchers, reportFilters) : []),
    [bundle, reportFilters],
  );

  const filteredExpenseRegister = useMemo(
    () => (bundle ? filterVouchers(bundle.expenseRegister ?? bundle.dExpenses, reportFilters) : []),
    [bundle, reportFilters],
  );

  const filteredTrialBalance = useMemo(
    () => (bundle ? filterTrialBalanceLines(bundle.trialBalance, reportFilters) : []),
    [bundle, reportFilters],
  );

  const filteredReceivables = useMemo(
    () => (bundle ? filterAccounts(bundle.receivables, reportFilters) : []),
    [bundle, reportFilters],
  );

  const filteredPayables = useMemo(
    () => (bundle ? filterAccounts(bundle.payables, reportFilters) : []),
    [bundle, reportFilters],
  );

  const activeStatement = useMemo(() => {
    if (statementBook === 'inr' && inrStatement) {
      return {
        account: { name: inrStatement.accountName } as ICFundAccount,
        opening: inrStatement.opening,
        closing: inrStatement.closing,
        lines: filterStatementLines(inrStatement.lines, reportFilters),
        currency: 'INR' as const,
      };
    }
    if (!statement) return null;
    return {
      ...statement,
      lines: filterStatementLines(statement.lines, reportFilters),
      currency: 'AED' as const,
    };
  }, [inrStatement, reportFilters, statement, statementBook]);

  const exportSubtitle = useMemo(() => {
    let book: string | undefined;
    if (reportView === 'statement') book = statementBook === 'inr' ? 'INR' : 'AED';
    else if (reportView === 'profit-loss') book = plBook === 'inr' ? 'Metal INR' : 'AED ledger';
    else if (reportView === 'metal-trades') book = metalBook === 'aed' ? 'AED agent' : 'Cash metal INR';
    else if (reportView === 'warehouse-pl') book = warehouseBook === 'metal' ? 'Metal' : 'IC cash AED';
    return formatReportFilterSummary(reportFilters, {
      period: periodLabel,
      accountName: activeStatement?.account.name,
      book,
    });
  }, [
    activeStatement?.account.name,
    metalBook,
    periodLabel,
    plBook,
    reportFilters,
    reportView,
    statementBook,
    warehouseBook,
  ]);

  const reportTitle = reportCatalogTitle(reportView);

  const booksKpiMetrics = useMemo(() => {
    if (reportView === 'statement') {
      if (!activeStatement) return [];
    } else if (reportView === 'warehouse-pl') {
      if (!warehousePl) return [];
    } else if (reportView === 'fund-trades' || reportView === 'metal-trades') {
      if (!displayedSettlementReport) return [];
    } else if (!bundle) {
      return [];
    }

    const reportSlice =
      reportView === 'profit-loss'
        ? plBook
        : reportView === 'warehouse-pl'
          ? warehouseBook
          : reportView === 'metal-trades'
            ? metalBook
            : undefined;

    return computeBooksKpis({
      reportView,
      profitLoss: bundle?.profitLoss,
      plStatement: bundle?.plStatement,
      balanceSheet: bundle?.balanceSheet,
      trialBalance: filteredTrialBalance,
      vouchers:
        reportView === 'd-expenses'
          ? filteredExpenseRegister
          : reportView === 'all-vouchers'
            ? filteredAllVouchers
            : [],
      cashBank: bundle?.cashBank,
      receivables: filteredReceivables,
      payables: filteredPayables,
      warehousePl: warehousePl
        ? {
            ...warehousePl,
            warehouses: filteredWarehouseSummaries,
            lines: filteredWarehouseLines,
          }
        : null,
      settlementTradeReport: displayedSettlementReport,
      statement: activeStatement,
      reportSlice,
    });
  }, [
    activeStatement,
    bundle,
    displayedSettlementReport,
    filteredAllVouchers,
    filteredExpenseRegister,
    filteredPayables,
    filteredReceivables,
    filteredTrialBalance,
    filteredWarehouseLines,
    filteredWarehouseSummaries,
    metalBook,
    plBook,
    reportView,
    warehouseBook,
    warehousePl,
  ]);

  const handleExportCsv = useCallback(() => {
    if (reportView === 'fund-trades' || reportView === 'metal-trades') {
      if (!displayedSettlementReport) return;
      const isMetal = displayedSettlementReport.settlementMode === 'metal';
      const metalAed = isMetal && metalBook === 'aed';
      const headers = isMetal
        ? metalAed
          ? ['Type', 'Date', 'Reference', 'Counterparty', 'AED agent', 'Warehouse', 'Fine weight (g)', 'Amount (AED)', 'Status']
          : ['Type', 'Date', 'Reference', 'Counterparty', 'Warehouse', 'Fine weight (g)', 'INR/g', 'INR value', 'P&L (INR)', 'Status']
        : ['Type', 'Date', 'Reference', 'Counterparty', 'Warehouse', 'Units', 'Rate (AED)', 'Amount (AED)', 'Status'];
      const rows = [...displayedSettlementReport.purchases, ...displayedSettlementReport.sales].map(r => {
        const status =
          r.txnKind === 'purchase' ? r.paymentStatus || r.paymentMethod || '' : r.orderStatus || r.paymentStatus || '';
        if (isMetal && metalAed) {
          return [
            r.txnKind,
            r.date.slice(0, 10),
            r.reference,
            r.counterparty,
            r.aedAgentName ?? '',
            r.warehouseName || '',
            r.metalWeightG ?? '',
            r.aedTotal,
            status,
          ];
        }
        if (isMetal) {
          return [
            r.txnKind,
            r.date.slice(0, 10),
            r.reference,
            r.counterparty,
            r.warehouseName || '',
            r.metalWeightG ?? '',
            r.metalRateInrPerG ?? '',
            r.inrTotal ?? '',
            r.bookedProfitInr ?? (r.bookedCurrency === 'INR' ? r.bookedProfit ?? '' : ''),
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
      downloadCsv(
        reportView === 'metal-trades'
          ? metalAed
            ? 'metal-register-aed-agent.csv'
            : 'metal-register-inr.csv'
          : 'fund-register.csv',
        headers,
        rows,
      );
      return;
    }

    if (reportView === 'statement' && activeStatement) {
      const book = activeStatement.currency ?? 'AED';
      const labels = icfLedgerColumnLabelFor(book);
      downloadCsv(
        book === 'INR' ? 'statement-of-account-inr.csv' : 'statement-of-account-aed.csv',
        ['Date', '#', 'Type', 'Particulars', labels.debit, labels.credit, labels.balance, 'Remark'],
        [
          ...activeStatement.lines.map(l => [
            l.date,
            l.voucherNo,
            l.voucherType,
            l.particulars,
            l.debit,
            l.credit,
            l.balance,
            l.notes || '',
          ]),
        ],
      );
      return;
    }

    if (reportView === 'warehouse-pl' && warehousePl) {
      if (warehouseBook === 'metal') {
        downloadCsv(
          'warehouse-statement-metal.csv',
          ['Warehouse', 'Opening g', 'In g', 'Out g', 'Closing g', 'P&L INR', 'Agent P&L AED'],
          [
            ...filteredWarehouseSummaries.map(w => [
              w.warehouseName,
              w.openingMetalG,
              w.metalInG,
              w.metalOutG,
              w.closingMetalG,
              w.metalProfitInr,
              w.metalProfitAed,
            ]),
          ],
        );
        return;
      }
      downloadCsv(
        'warehouse-statement-ic.csv',
        ['Warehouse', 'Opening units', 'In units', 'Out units', 'Closing units', 'IC profit AED'],
        [
          ...filteredWarehouseSummaries.map(w => [
            w.warehouseName,
            w.openingUnits,
            w.unitsIn,
            w.unitsOut,
            w.closingUnits,
            w.grossProfit,
          ]),
        ],
      );
      return;
    }

    if (!bundle) return;

    if (reportView === 'all-vouchers') {
      downloadCsv(
        'day-book.csv',
        ['Date', 'Vch #', 'Type', 'Debit', 'Credit', 'Amount', 'Notes'],
        [
          ...filteredAllVouchers.map(v => [
            v.voucherDate,
            v.voucherNo,
            v.voucherType,
            v.debitAccountName,
            v.creditAccountName,
            v.amount,
            v.notes || '',
          ]),
        ],
      );
      return;
    }

    if (reportView === 'd-expenses') {
      downloadCsv(
        'expense-register.csv',
        ['Date', 'Vch #', 'Type', 'Debit', 'Credit', 'Amount', 'Notes'],
        [
          ...filteredExpenseRegister.map(v => [
            v.voucherDate,
            v.voucherNo,
            v.voucherType,
            v.debitAccountName,
            v.creditAccountName,
            v.amount,
            v.notes || '',
          ]),
        ],
      );
      return;
    }

    if (reportView === 'trial-balance') {
      downloadCsv(
        'trial-balance.csv',
        ['Account', 'Type', 'Opening Dr', 'Opening Cr', 'Period Dr', 'Period Cr', 'Closing Dr', 'Closing Cr'],
        [
          ...filteredTrialBalance.map(l => [
            l.accountName,
            l.accountType,
            l.openingDebit ?? 0,
            l.openingCredit ?? 0,
            l.periodDebit ?? 0,
            l.periodCredit ?? 0,
            l.closingDebit ?? l.debit,
            l.closingCredit ?? l.credit,
          ]),
        ],
      );
      return;
    }

    if (reportView === 'profit-loss' && bundle.plStatement) {
      if (plBook === 'inr') {
        const metalLines = filteredWarehouseLines.filter(
          l => l.settlementMode === 'metal' && l.bookedCurrency !== 'AED',
        );
        const saleInr = metalLines.reduce((s, l) => s + l.revenue, 0);
        const cogsInr = metalLines.reduce((s, l) => s + l.cogs, 0);
        downloadCsv('profit-and-loss-metal-inr.csv', ['Section', 'Amount (INR)'], [
          ['Metal sold', saleInr],
          ['Cost of metal', -cogsInr],
          ['Metal profit / (loss)', warehousePl?.totals.metalProfitInr ?? 0],
        ]);
        return;
      }
      const s = bundle.plStatement;
      downloadCsv('profit-and-loss-aed.csv', ['Section', 'Amount (AED)'], [
        ['Sales', s.salesTotal],
        ['Cost of IC sold', -s.directCostsTotal],
        ['Gross profit', s.grossResult],
        ['Operating expenses', -s.operatingTotal],
        ['Net profit / (loss)', s.netForPeriod],
      ]);
    }
  }, [
    activeStatement,
    bundle,
    displayedSettlementReport,
    filteredAllVouchers,
    filteredExpenseRegister,
    filteredTrialBalance,
    filteredWarehouseLines,
    filteredWarehouseSummaries,
    metalBook,
    plBook,
    reportView,
    warehouseBook,
    warehousePl,
  ]);

  const headerToolbar = useMemo(
    () => (
      <>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => openReportPreviewNewTab('icf-report-print', { title: reportTitle, subtitle: exportSubtitle })}
        >
          View
        </button>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => exportReportPdfFromElement('icf-report-print', { title: reportTitle, subtitle: exportSubtitle })}
        >
          Export PDF
        </button>
        <button type="button" className={btnSecondary} onClick={handleExportCsv}>
          Export CSV
        </button>
      </>
    ),
    [exportSubtitle, handleExportCsv, reportTitle],
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
                <td className={`${icfTd} text-right font-mono tabular-nums`}><FmtLedgerAed amount={row.amount} /></td>
                <td className={icfTd}><VoucherUserCell voucher={row} /></td>
                <td className={`${icfTd} max-w-[12rem] truncate text-slate-500`}>{row.notes || '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const totalDr =
    activeStatement?.lines.reduce((s, l) => s + (l.status === 'pending' ? 0 : l.debit), 0) ?? 0;
  const totalCr =
    activeStatement?.lines.reduce((s, l) => s + (l.status === 'pending' ? 0 : l.credit), 0) ?? 0;
  const statementCurrency = activeStatement?.currency ?? 'AED';
  const statementCols = icfLedgerColumnLabelFor(statementCurrency);
  const metalInrLines = filteredWarehouseLines.filter(
    l => l.settlementMode === 'metal' && l.bookedCurrency !== 'AED',
  );

  return (
    <div>
      {confirmDialog}
      <div className={`${icfCard} min-w-0`}>
        <FinancialReportFilterPanel
          date={{
            dateFilter,
            setDateFilter,
            customStartDate,
            setCustomStartDate,
            customEndDate,
            setCustomEndDate,
          }}
          filters={{
            reportView,
            filters: reportFilters,
            onChange: setReportFilters,
            accountOptions: accountSearchOptions,
            accountId,
            onAccountId: setAccountId,
            warehouseOptions: warehouseSearchOptions,
            counterpartyOptions: counterpartySearchOptions,
            statementBook,
            onStatementBook: setStatementBook,
            showInrBookTab: Boolean(inrAccountId),
          }}
        />

        {booksKpiMetrics.length > 0 ? <AsicKpiStrip metrics={booksKpiMetrics} className="mx-4 mb-2 mt-2" /> : null}

        {error ? <p className="px-4 py-2 text-sm text-red-600">{error}</p> : null}
        <div id="icf-report-print">
        {exportSubtitle ? (
          <p className="border-b border-slate-100 px-4 py-2 text-[11px] leading-snug text-slate-600 text-justify dark:text-[var(--theme-text-secondary)]">
            {exportSubtitle}
          </p>
        ) : null}
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
            <p className={`${icfTd} py-8 text-center text-slate-500`}>
              Choose an account above to load its statement of account.
            </p>
          ) : (
            <div>
              <ReportCaption>
                {periodLabel} · {statementCurrency} book. AED and INR are separate ledgers — do not add the balances.
              </ReportCaption>
            <div className={icfTableWrap}>
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className={icfTheadRow}>
                    <th className={icfTh}>Date</th>
                    <th className={icfTh}>#</th>
                    <th className={icfTh}>Type</th>
                    <th className={icfTh}>Particulars</th>
                    <th className={icfThAlign('right')}>{statementCols.debit}</th>
                    <th className={icfThAlign('right')}>{statementCols.credit}</th>
                    <th className={icfThAlign('right')}>{statementCols.balance}</th>
                    <th className={icfTh}>User</th>
                    <th className={icfTh}>Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && statementBook === 'aed' ? (
                    <ASICTableRowsSkeleton rows={8} cols={9} />
                  ) : loading && statementBook === 'inr' ? (
                    <ASICTableRowsSkeleton rows={8} cols={9} />
                  ) : (
                    activeStatement?.lines.map((line, i) => (
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
                        <AmountCell n={line.debit} currency={statementCurrency} />
                        <AmountCell n={line.credit} danger currency={statementCurrency} />
                        <td className={`${icfTd} text-right font-mono tabular-nums`}>
                          <FmtLedgerAmount amount={line.balance} book={statementCurrency} />
                        </td>
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
                {activeStatement ? (
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50 font-medium">
                      <td className={icfTd} colSpan={4}>Totals</td>
                      <td className={`${icfTd} text-right font-mono tabular-nums`}>
                        <FmtLedgerAmount amount={totalDr} book={statementCurrency} />
                      </td>
                      <td className={`${icfTd} text-right font-mono tabular-nums text-red-600`}>
                        <FmtLedgerAmount amount={totalCr} book={statementCurrency} />
                      </td>
                      <td className={`${icfTd} text-right font-mono tabular-nums`}>
                        <FmtLedgerAmount amount={activeStatement.closing} book={statementCurrency} />
                      </td>
                      <td className={icfTd} />
                      <td className={icfTd} />
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
            </div>
          )
        ) : null}

        {bundle && reportView === 'all-vouchers' ? (
          <DayBookReport
            vouchers={filteredAllVouchers}
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
        {bundle && reportView === 'd-expenses' ? (
          <div>
            <ReportCaption>
              {periodLabel} · {AED_LEDGER_CAPTION}
            </ReportCaption>
            {voucherTable(filteredExpenseRegister, 'No expense vouchers match these filters.')}
          </div>
        ) : null}
        {bundle && reportView === 'receivables' ? (
          <div className="grid sm:grid-cols-2">
            <p className="border-b border-slate-200 px-2.5 py-1 text-[11px] text-slate-500 sm:col-span-2">
              {asOfLabel} · {AED_LEDGER_CAPTION}
            </p>
            <div className="border-b border-slate-200 sm:border-b-0 sm:border-r">
              <p className="border-b border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-500">
                Customers owe us (AED)
              </p>
              {accountTable(filteredReceivables, 'No receivable balances match these filters.')}
            </div>
            <div>
              <p className="border-b border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-500">
                We owe suppliers (AED)
              </p>
              {accountTable(filteredPayables, 'No payable balances match these filters.')}
            </div>
          </div>
        ) : null}
        {bundle && reportView === 'profit-loss' && bundle.plStatement ? (
          <ProfitLossReport
            statement={bundle.plStatement}
            periodLabel={periodLabel}
            slug={slug}
            accounts={accounts}
            periodMetalPlInr={warehousePl?.totals.metalProfitInr ?? null}
            metalSoldG={warehousePl?.totals.metalSoldG ?? 0}
            metalSaleInr={metalInrLines.reduce((s, l) => s + l.revenue, 0)}
            metalCogsInr={metalInrLines.reduce((s, l) => s + l.cogs, 0)}
            book={plBook}
            onBookChange={setPlBook}
          />
        ) : null}
        {warehousePl && reportView === 'warehouse-pl' ? (
          <WarehouseStatementReport
            report={warehousePl}
            warehouses={filteredWarehouseSummaries}
            lines={filteredWarehouseLines}
            periodLabel={periodLabel}
            book={warehouseBook}
            onBookChange={setWarehouseBook}
          />
        ) : null}
        {displayedSettlementReport && (reportView === 'fund-trades' || reportView === 'metal-trades') ? (
          <SettlementTradeReport
            report={displayedSettlementReport}
            periodLabel={periodLabel}
            variant={
              reportView === 'fund-trades' ? 'fund' : metalBook === 'aed' ? 'metal-agent' : 'metal-inr'
            }
            metalBook={reportView === 'metal-trades' ? metalBook : undefined}
            onMetalBookChange={reportView === 'metal-trades' ? setMetalBook : undefined}
          />
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
            lines={filteredTrialBalance}
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
