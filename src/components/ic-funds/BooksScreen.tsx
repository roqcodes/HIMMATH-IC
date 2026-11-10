'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useICFundsReportHeaderToolbar } from '@/components/ic-funds/ICFundsReportsChrome';
import Link from 'next/link';
import {
  getICFundBooksReportAction,
  type ICFundBooksReportData,
  type ICFundVoucherRangeStats,
  getICFundProfitLossReportAction,
  getICFundStatementAction,
  getInrFundStatementAction,
  getICSettlementTradeReportAction,
  getICWarehousePLReportAction,
  listICFundAccountsLiteAction,
  resolveInrFundAccountIdForIcFundAccountAction,
} from '@/app/actions/icFundsActions';
import { accountTypeLabel, IC_FUND_VOUCHER_LABELS } from '@/lib/icFunds/constants';
import { ledgerAccountTypeCaption } from '@/lib/icFunds/voucherPartyAccounts';
import { fmtICDate, fmtLedgerAed, fmtLedgerAmount, icfLedgerColumnLabel, FmtLedgerAed, FmtLedgerAmount } from '@/lib/icFunds/format';
import { formatReportPeriodCaption } from '@/lib/icFunds/reportCaptions';
import { downloadCsv, exportReportPdfFromElement, openReportPreviewNewTab } from '@/lib/icFunds/booksExport';
import {
  exportStatementOfAccountPdf,
  openStatementOfAccountPreview,
  type StatementOfAccountExportData,
} from '@/lib/icFunds/statementOfAccountExport';
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
import SettlementTradeReport, {
  type SettlementTradeReportVariant,
} from '@/components/ic-funds/reports/SettlementTradeReport';
import CapitalRegisterReport from '@/components/ic-funds/reports/CapitalRegisterReport';
import { icFundsReportPath, type ICFundsReportId } from '@/lib/icFunds/nav';
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
import type { ICFundProfitLossReport } from '@/lib/icFunds/plReportTypes';
import type { ICWarehousePLReport } from '@/lib/icFunds/warehouseProfit';
import type { ICSettlementTradeReport } from '@/lib/icFunds/settlementTradeReport';
import type { ICFundAccount, ICFundStatementLine, ICFundVoucher } from '@/types';

type ReportBundle = ICFundBooksReportData;

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
    todayAnchor,
  } = useICFundsDateFilter(branch?.timezone, 'this-month');
  const [bundle, setBundle] = useState<ReportBundle | null>(null);
  const [voucherRangeStats, setVoucherRangeStats] = useState<ICFundVoucherRangeStats | null>(null);
  const [plReport, setPlReport] = useState<ICFundProfitLossReport | null>(null);
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
  const [fundLedgerBook, setFundLedgerBook] = useState<'aed' | 'inr'>('aed');
  const [profitLossBook, setProfitLossBook] = useState<'aed' | 'inr'>('aed');
  const [warehouseStatementBook, setWarehouseStatementBook] = useState<'ic' | 'metal'>('ic');
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
    } else {
      setWarehousePl(result.data);
    }
    setLoading(false);
  }, [branchId, endDate, showLoadError, startDate]);

  const loadProfitLoss = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await trackLoading(() =>
      getICFundProfitLossReportAction({
        branchId,
        startDate,
        endDate,
        warehouseId: reportFilters.warehouseId?.trim() || undefined,
      }),
    );
    if (!result.success) {
      await showLoadError('BooksScreen.loadProfitLoss', result.error);
      setPlReport(null);
    } else {
      setPlReport(result.data);
    }
    setLoading(false);
  }, [branchId, endDate, reportFilters.warehouseId, showLoadError, startDate]);

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
    const bundleViews = [
      'all-vouchers',
      'cash-bank',
      'd-expenses',
      'receivables',
      'trial-balance',
      'balance-sheet',
    ] as const;
    if (!(bundleViews as readonly string[]).includes(reportView)) return;
    setLoading(true);
    setError(null);
    const ledgerBook = fundLedgerBook === 'inr' ? 'INR' : 'AED';
    const result = await trackLoading(() =>
      getICFundBooksReportAction({
        branchId,
        startDate,
        endDate,
        reportView: reportView as 'all-vouchers' | 'cash-bank' | 'd-expenses' | 'receivables' | 'trial-balance' | 'balance-sheet',
        ledgerBook: reportView === 'all-vouchers' ? ledgerBook : undefined,
      }),
    );
    if (!result.success) {
      await showLoadError('BooksScreen.loadBundle', result.error);
    } else {
      setBundle(result.data);
      setVoucherRangeStats(result.data.voucherRangeStats ?? null);
    }
    setLoading(false);
  }, [branchId, endDate, fundLedgerBook, reportView, showLoadError, startDate]);

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
    } else {
      setStatement(result.data);
    }
    setLoading(false);
  }, [accountId, branchId, endDate, showLoadError, startDate]);

  useEffect(() => {
    void trackLoading(() => listICFundAccountsLiteAction(branchId).then(setAccounts));
  }, [branchId]);

  useEffect(() => {
    if (reportView !== 'statement') return;
    setReportFilters(prev => (prev.warehouseId ? { ...prev, warehouseId: '' } : prev));
  }, [reportView]);

  useEffect(() => {
    if (reportView !== 'statement' || !accountId) return;
    const acc = accounts.find(a => a.id === accountId);
    if (acc?.sourceType === 'ic_warehouse') setAccountId('');
  }, [accountId, accounts, reportView]);

  useEffect(() => {
    if (reportView === 'statement') {
      void loadStatement();
      return;
    }
    if (reportView === 'profit-loss') {
      void loadProfitLoss();
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
  }, [loadBundle, loadProfitLoss, loadStatement, loadSettlementTradeReport, loadWarehousePl, reportView, fundLedgerBook]);

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
    if (reportView !== 'statement') {
      setInrStatement(null);
      return;
    }
    if (!inrAccountId) {
      setInrStatement(null);
      return;
    }

    const isVisibleTab = statementBook === 'inr';
    if (isVisibleTab) setLoading(true);

    const loader = () =>
      getInrFundStatementAction({ branchId, accountId: inrAccountId, startDate, endDate }).then(result => {
        if (!result.success) {
          if (isVisibleTab) void showLoadError('BooksScreen.loadInrStatement', result.error);
          setInrStatement(null);
        } else {
          setInrStatement({
            opening: result.data.opening,
            closing: result.data.closing,
            lines: result.data.lines,
            accountName: result.data.account.name,
          });
        }
        if (isVisibleTab) setLoading(false);
      });

    if (isVisibleTab) {
      void trackLoading(loader);
    } else {
      void loader();
    }
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

  /** Warehouse balances have a dedicated "Warehouse statement" report — hide them here. */
  const accountSearchOptions: EntitySearchOption[] = useMemo(
    () =>
      accounts
        .filter(a => a.sourceType !== 'ic_warehouse')
        .map(a => ({
          value: a.id,
          label: a.name,
          detail: ledgerAccountTypeCaption(a),
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

  const settlementTradeReportVariant = useMemo<SettlementTradeReportVariant>(() => {
    const report = filteredSettlementReport ?? settlementTradeReport;
    if (!report || report.settlementMode !== 'metal') return 'fund';
    const hasAgentAed = [...report.purchases, ...report.sales].some(r => r.metalPaymentMethod === 'AED');
    return hasAgentAed ? 'metal-agent' : 'metal-inr';
  }, [filteredSettlementReport, settlementTradeReport]);

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

  const activeLedgerBook = useMemo((): 'AED' | 'INR' => {
    if (reportView === 'statement') return statementBook === 'inr' ? 'INR' : 'AED';
    if (
      reportView === 'receivables' ||
      reportView === 'all-vouchers' ||
      reportView === 'trial-balance'
    ) {
      return fundLedgerBook === 'inr' ? 'INR' : 'AED';
    }
    return 'AED';
  }, [fundLedgerBook, reportView, statementBook]);

  /** HQ INR fund exists (not the statement account link). */
  const inrBooksAvailable = useMemo(
    () => (bundle?.inrAccounts?.length ?? 0) > 0,
    [bundle?.inrAccounts],
  );

  const reportAccounts = useMemo(() => {
    if (!bundle) return accounts;
    if (activeLedgerBook === 'INR' && bundle.inrAccounts?.length) return bundle.inrAccounts;
    return accounts;
  }, [accounts, activeLedgerBook, bundle]);

  const filteredAllVouchers = useMemo(() => {
    if (!bundle) return [];
    const source = activeLedgerBook === 'INR' ? bundle.inrAllVouchers : bundle.allVouchers;
    return filterVouchers(source ?? [], reportFilters);
  }, [activeLedgerBook, bundle, reportFilters]);

  const filteredExpenseRegister = useMemo(
    () => (bundle ? filterVouchers(bundle.expenseRegister ?? bundle.dExpenses, reportFilters) : []),
    [bundle, reportFilters],
  );

  const filteredTrialBalance = useMemo(() => {
    if (!bundle) return [];
    const source =
      activeLedgerBook === 'INR' ? bundle.inrTrialBalance ?? [] : bundle.trialBalance ?? [];
    return filterTrialBalanceLines(source, reportFilters);
  }, [activeLedgerBook, bundle, reportFilters]);

  const filteredReceivables = useMemo(() => {
    if (!bundle) return [];
    const source = activeLedgerBook === 'INR' ? bundle.inrReceivables : bundle.receivables;
    return filterAccounts(source ?? [], reportFilters);
  }, [activeLedgerBook, bundle, reportFilters]);

  const filteredPayables = useMemo(() => {
    if (!bundle) return [];
    const source = activeLedgerBook === 'INR' ? bundle.inrPayables : bundle.payables;
    return filterAccounts(source ?? [], reportFilters);
  }, [activeLedgerBook, bundle, reportFilters]);

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

  const exportSubtitle = useMemo(
    () =>
      formatReportFilterSummary(reportFilters, {
        period: periodLabel,
        accountName: activeStatement?.account.name,
        book: statementBook === 'inr' ? 'INR' : undefined,
        omitWarehouseCaption: reportView === 'warehouse-pl' || reportView === 'statement',
      }),
    [activeStatement?.account.name, periodLabel, reportFilters, reportView, statementBook],
  );

  const reportTitle = reportCatalogTitle(reportView);

  const booksKpiMetrics = useMemo(() => {
    if (reportView === 'statement') {
      if (!activeStatement) return [];
    } else if (reportView === 'warehouse-pl') {
      if (!warehousePl) return [];
    } else if (reportView === 'profit-loss') {
      if (!plReport) return [];
    } else if (reportView === 'fund-trades' || reportView === 'metal-trades') {
      if (!filteredSettlementReport) return [];
    } else if (!bundle) {
      return [];
    }

    return computeBooksKpis({
      reportView,
      profitLoss: plReport?.profitLoss ?? bundle?.profitLoss,
      plStatement: plReport?.plStatement ?? bundle?.plStatement,
      balanceSheet: bundle?.balanceSheet,
      trialBalance: filteredTrialBalance,
      voucherRangeStats: voucherRangeStats ?? undefined,
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
      settlementTradeReport: filteredSettlementReport,
      statement: activeStatement,
      ledgerBook: activeLedgerBook,
    });
  }, [
    activeLedgerBook,
    activeStatement,
    bundle,
    filteredAllVouchers,
    filteredExpenseRegister,
    filteredPayables,
    filteredReceivables,
    filteredSettlementReport,
    filteredTrialBalance,
    filteredWarehouseLines,
    filteredWarehouseSummaries,
    plReport,
    reportView,
    voucherRangeStats,
    warehousePl,
  ]);

  const handleExportCsv = useCallback(() => {
    if (reportView === 'fund-trades' || reportView === 'metal-trades') {
      if (!filteredSettlementReport) return;
      const isMetal = filteredSettlementReport.settlementMode === 'metal';
      const headers = isMetal
        ? [
            'Type',
            'Date',
            'Reference',
            'Counterparty',
            'Warehouse',
            'Fine weight (g)',
            'INR/g',
            'INR value',
            'Units',
            'Rate (AED)',
            'Amount (AED)',
            'P&L',
            'Status',
          ]
        : ['Type', 'Date', 'Reference', 'Counterparty', 'Warehouse', 'Units', 'Rate (AED)', 'Amount (AED)', 'Status'];
      const rows = [...filteredSettlementReport.purchases, ...filteredSettlementReport.sales].map(r => {
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
            r.inrTotal ?? '',
            r.units,
            r.unitRateAed,
            r.aedTotal,
            r.bookedProfit ?? '',
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
        reportView === 'metal-trades' ? 'metal-register.csv' : 'fund-register.csv',
        headers,
        rows,
      );
      return;
    }

    if (reportView === 'statement') {
      const targetAccount = accounts.find(a => a.id === accountId) ?? statement?.account;
      if (!targetAccount) return;

      const aedLines = statement?.lines ? filterStatementLines(statement.lines, reportFilters) : [];
      const inrLines = inrStatement?.lines ? filterStatementLines(inrStatement.lines, reportFilters) : [];

      const headers = ['Book', 'Date', '#', 'Type', 'Particulars', 'Debit', 'Credit', 'Balance', 'Remark'];
      const rows: (string | number)[][] = [];

      for (const l of aedLines) {
        rows.push([
          'AED',
          l.date ? l.date.slice(0, 10) : '',
          l.voucherNo === 0 ? 'OB' : l.voucherNo,
          l.voucherType,
          l.particulars,
          l.debit || '',
          l.credit || '',
          l.balance,
          l.notes || '',
        ]);
      }

      if (inrLines.length > 0) {
        rows.push(['', '', '', '', '', '', '', '', '']);
        for (const l of inrLines) {
          rows.push([
            'INR',
            l.date ? l.date.slice(0, 10) : '',
            l.voucherNo === 0 ? 'OB' : l.voucherNo,
            l.voucherType,
            l.particulars,
            l.debit || '',
            l.credit || '',
            l.balance,
            l.notes || '',
          ]);
        }
      }

      const slugName = targetAccount.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      downloadCsv(`statement-${slugName}.csv`, headers, rows);
      return;
    }

    if (reportView === 'warehouse-pl' && warehousePl) {
      downloadCsv(
        'warehouse-statement.csv',
        [
          'Warehouse',
          'Opening units',
          'In units',
          'Out units',
          'Closing units',
          'Opening g',
          'In g',
          'Out g',
          'Closing g',
          'IC gross AED',
          'Metal P&L INR',
        ],
        [
          ...filteredWarehouseSummaries.map(w => [
            w.warehouseName,
            w.openingUnits,
            w.unitsIn,
            w.unitsOut,
            w.closingUnits,
            w.openingMetalG,
            w.metalInG,
            w.metalOutG,
            w.closingMetalG,
            w.grossProfit,
            w.metalProfitInr,
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

    if (reportView === 'profit-loss' && plReport?.plStatement) {
      const s = plReport.plStatement;
      downloadCsv('profit-and-loss.csv', ['Section', 'Amount (AED)'], [
        ['Sales / income', s.salesTotal],
        ['Direct costs', -s.directCostsTotal],
        ['Gross result', s.grossResult],
        ['Operating expenses', -s.operatingTotal],
        ['Net for period', s.netForPeriod],
        ...(warehousePl
          ? [['Metal P&L (INR, operational)', warehousePl.totals.metalProfitInr]]
          : []),
      ]);
    }
  }, [
    accountId,
    accounts,
    activeStatement,
    bundle,
    filteredAllVouchers,
    filteredExpenseRegister,
    filteredSettlementReport,
    filteredTrialBalance,
    filteredWarehouseSummaries,
    inrStatement,
    reportFilters,
    reportView,
    statement,
    warehousePl,
  ]);

  const prepareStatementExportData = useCallback(async (): Promise<StatementOfAccountExportData | null> => {
    const targetAccount = accounts.find(a => a.id === accountId) ?? statement?.account;
    if (!targetAccount) return null;

    let inrData = inrStatement;
    if (!inrData && inrAccountId) {
      const res = await getInrFundStatementAction({ branchId, accountId: inrAccountId, startDate, endDate });
      if (res.success) {
        inrData = {
          opening: res.data.opening,
          closing: res.data.closing,
          lines: res.data.lines,
          accountName: res.data.account.name,
        };
      }
    }

    const filteredAedLines = statement?.lines
      ? filterStatementLines(statement.lines, reportFilters)
      : [];
    const filteredInrLines = inrData?.lines
      ? filterStatementLines(inrData.lines, reportFilters)
      : [];

    return {
      account: targetAccount,
      branchName: branch?.name ?? 'Himmath HQ',
      periodLabel,
      startDate,
      endDate,
      inrLedgerLinked: Boolean(inrAccountId),
      aedStatement: statement
        ? {
            opening: statement.opening,
            closing: statement.closing,
            lines: filteredAedLines,
          }
        : null,
      inrStatement: inrData
        ? {
            opening: inrData.opening,
            closing: inrData.closing,
            lines: filteredInrLines,
            accountName: inrData.accountName,
          }
        : null,
    };
  }, [
    accountId,
    accounts,
    branch?.name,
    branchId,
    endDate,
    inrAccountId,
    inrStatement,
    periodLabel,
    reportFilters,
    startDate,
    statement,
  ]);

  const handleView = useCallback(async () => {
    if (reportView === 'statement') {
      const exportData = await prepareStatementExportData();
      if (!exportData) {
        await alert({
          title: 'Select an account',
          message: 'Please choose an account first to view its statement of account.',
          variant: 'info',
        });
        return;
      }
      openStatementOfAccountPreview(exportData);
      return;
    }
    openReportPreviewNewTab('icf-report-print', { title: reportTitle, subtitle: exportSubtitle });
  }, [alert, exportSubtitle, prepareStatementExportData, reportTitle, reportView]);

  const handleExportPdf = useCallback(async () => {
    if (reportView === 'statement') {
      const exportData = await prepareStatementExportData();
      if (!exportData) {
        await alert({
          title: 'Select an account',
          message: 'Please choose an account first to export its statement of account.',
          variant: 'info',
        });
        return;
      }
      exportStatementOfAccountPdf(exportData);
      return;
    }
    exportReportPdfFromElement('icf-report-print', { title: reportTitle, subtitle: exportSubtitle });
  }, [alert, exportSubtitle, prepareStatementExportData, reportTitle, reportView]);

  const headerToolbar = useMemo(
    () => (
      <>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => void handleView()}
        >
          View
        </button>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => void handleExportPdf()}
        >
          Export PDF
        </button>
        <button type="button" className={btnSecondary} onClick={handleExportCsv}>
          Export CSV
        </button>
      </>
    ),
    [handleExportCsv, handleExportPdf, handleView],
  );

  useICFundsReportHeaderToolbar(headerToolbar);

  const accountTable = (
    rows: ICFundAccount[],
    empty: string,
    showAsOf = false,
    currency: 'AED' | 'INR' = 'AED',
  ) => (
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
                <td className={`${icfTd} text-slate-500`}>{ledgerAccountTypeCaption(row)}</td>
                <AmountCell
                  n={ledgerById.get(row.id)?.opening ?? row.openingBalance}
                  currency={currency}
                />
                <BalanceWithPendingCell
                  balance={row.balance}
                  pendingBalance={row.pendingBalance}
                  book={currency}
                />
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
            todayAnchor,
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
            fundLedgerBook,
            onFundLedgerBook: setFundLedgerBook,
            showFundLedgerBookTab:
              inrBooksAvailable &&
              (reportView === 'receivables' ||
                reportView === 'all-vouchers' ||
                reportView === 'trial-balance'),
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
        {loading &&
        reportView !== 'statement' &&
        reportView !== 'warehouse-pl' &&
        reportView !== 'profit-loss' &&
        !bundle ? (
          <ASICTableSkeleton framed={false} cols={7} rows={8} />
        ) : null}
        {loading && reportView === 'profit-loss' && !plReport ? (
          <ASICTableSkeleton framed={false} cols={5} rows={10} />
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
          )
        ) : null}

        {bundle && reportView === 'all-vouchers' ? (
          <DayBookReport
            vouchers={filteredAllVouchers}
            slug={slug}
            accounts={reportAccounts}
            periodLabel={periodLabel}
            truncated={activeLedgerBook === 'INR' ? bundle.inrDayBookTruncated : bundle.dayBookTruncated}
            book={activeLedgerBook}
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
          voucherTable(filteredExpenseRegister, 'No expense vouchers match these filters.')
        ) : null}
        {bundle && reportView === 'receivables' ? (
          <div className="grid sm:grid-cols-2">
            <p className="border-b border-slate-200 px-2.5 py-1 text-[11px] text-slate-500 sm:col-span-2">
              {asOfLabel} · {activeLedgerBook} trade parties
            </p>
            <div className="border-b border-slate-200 sm:border-b-0 sm:border-r">
              <p className="border-b border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-500">Receivables</p>
              {accountTable(
                filteredReceivables,
                'No receivable balances match these filters.',
                false,
                activeLedgerBook,
              )}
            </div>
            <div>
              <p className="border-b border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-500">Payables</p>
              {accountTable(
                filteredPayables,
                'No payable balances match these filters.',
                false,
                activeLedgerBook,
              )}
            </div>
          </div>
        ) : null}
        {reportView === 'capital-register' ? (
          <CapitalRegisterReport />
        ) : null}
        {plReport && reportView === 'profit-loss' ? (
          <ProfitLossReport
            statement={plReport.plStatement}
            periodLabel={periodLabel}
            slug={slug}
            accounts={accounts}
            periodMetalPlInr={plReport.metalPl.metalProfitInr}
            metalSoldG={plReport.metalPl.metalSoldG}
            metalSaleInr={plReport.metalPl.metalSaleInr}
            metalCogsInr={plReport.metalPl.metalCogsInr}
            book={profitLossBook}
            onBookChange={setProfitLossBook}
          />
        ) : null}
        {warehousePl && reportView === 'warehouse-pl' ? (
          <WarehouseStatementReport
            report={warehousePl}
            warehouses={filteredWarehouseSummaries}
            lines={filteredWarehouseLines}
            book={warehouseStatementBook}
            onBookChange={setWarehouseStatementBook}
          />
        ) : null}
        {filteredSettlementReport && (reportView === 'fund-trades' || reportView === 'metal-trades') ? (
          <SettlementTradeReport
            report={filteredSettlementReport}
            periodLabel={periodLabel}
            variant={settlementTradeReportVariant}
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
            accounts={reportAccounts}
            asAtLabel={asOfLabel}
            book={activeLedgerBook}
          />
        ) : null}
        </div>
      </div>
    </div>
  );
}
