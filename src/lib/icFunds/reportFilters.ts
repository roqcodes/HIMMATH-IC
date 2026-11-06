import type { ICFundAccount, ICFundStatementLine, ICFundTrialBalanceLine, ICFundVoucher } from '@/types';
import {
  summarizeSettlementTrades,
  type ICSettlementTradeLine,
  type ICSettlementTradeReport,
} from '@/lib/icFunds/settlementTradeReport';
import type { ICWarehousePLLine, ICWarehousePLWarehouseSummary } from '@/lib/icFunds/warehouseProfit';
import { isVoidIcSaleOrderStatus } from '@/lib/icFunds/icTransferReportFilters';

export type ReportVoucherStatusFilter = 'all' | 'posted' | 'pending' | 'void';
export type ReportExpenseKindFilter = 'all' | 'direct' | 'operating';
export type ReportTradeTypeFilter = 'all' | 'purchase' | 'sale';
export type ReportOrderStatusFilter = 'all' | 'open' | 'in_progress' | 'completed';

export type ReportFilterState = {
  search: string;
  voucherStatus: ReportVoucherStatusFilter;
  expenseKind: ReportExpenseKindFilter;
  tradeType: ReportTradeTypeFilter;
  orderStatus: ReportOrderStatusFilter;
  includeVoidOrders: boolean;
  warehouseId: string;
  counterpartyId: string;
};

export const DEFAULT_REPORT_FILTERS: ReportFilterState = {
  search: '',
  voucherStatus: 'all',
  expenseKind: 'all',
  tradeType: 'all',
  orderStatus: 'all',
  includeVoidOrders: false,
  warehouseId: '',
  counterpartyId: '',
};

function normSearch(q: string): string {
  return q.trim().toLowerCase();
}

function haystackIncludes(haystack: string, needle: string): boolean {
  if (!needle) return true;
  return haystack.toLowerCase().includes(needle);
}

export function voucherMatchesSearch(v: ICFundVoucher, q: string): boolean {
  const n = normSearch(q);
  if (!n) return true;
  return [
    v.voucherNo,
    v.voucherType,
    v.debitAccountName,
    v.creditAccountName,
    v.notes,
    v.referenceType,
    v.referenceId,
  ]
    .filter(Boolean)
    .some(part => haystackIncludes(String(part), n));
}

export function filterVouchers(
  rows: ICFundVoucher[],
  filters: ReportFilterState,
): ICFundVoucher[] {
  return rows.filter(v => {
    if (filters.voucherStatus === 'posted' && v.status !== 'active') return false;
    if (filters.voucherStatus === 'pending' && v.status !== 'pending') return false;
    if (filters.voucherStatus === 'void' && v.status !== 'void') return false;
    if (filters.expenseKind === 'direct') {
      if (v.debitAccountType !== 'd_expense' && v.creditAccountType !== 'd_expense') return false;
    }
    if (filters.expenseKind === 'operating') {
      if (v.debitAccountType !== 'expense' && v.creditAccountType !== 'expense') return false;
    }
    return voucherMatchesSearch(v, filters.search);
  });
}

export function statementLineMatchesSearch(line: ICFundStatementLine, q: string): boolean {
  const n = normSearch(q);
  if (!n) return true;
  return [
    line.particulars,
    line.voucherNo,
    line.voucherType,
    line.notes,
    line.referenceType,
    line.referenceId,
  ]
    .filter(Boolean)
    .some(part => haystackIncludes(String(part), n));
}

export function filterStatementLines(
  lines: ICFundStatementLine[],
  filters: ReportFilterState,
): ICFundStatementLine[] {
  return lines.filter(line => {
    if (line.voucherNo === 0) return true;
    if (filters.voucherStatus === 'posted' && line.status === 'pending') return false;
    if (filters.voucherStatus === 'pending' && line.status !== 'pending') return false;
    return statementLineMatchesSearch(line, filters.search);
  });
}

export function filterTrialBalanceLines(
  lines: ICFundTrialBalanceLine[],
  filters: ReportFilterState,
): ICFundTrialBalanceLine[] {
  const n = normSearch(filters.search);
  if (!n) return lines;
  return lines.filter(l => haystackIncludes(l.accountName, n) || haystackIncludes(l.accountType, n));
}

export function filterAccounts(
  rows: ICFundAccount[],
  filters: ReportFilterState,
): ICFundAccount[] {
  const n = normSearch(filters.search);
  if (!n) return rows;
  return rows.filter(a => haystackIncludes(a.name, n) || haystackIncludes(a.accountType, n));
}

function saleOrderBucket(status: string | undefined): ReportOrderStatusFilter | null {
  if (!status || status === 'completed') return 'completed';
  if (status === 'pending' || status === 'pending_branch_review' || status === 'accepted') return 'open';
  if (
    status === 'wh_processing' ||
    status === 'da_processing' ||
    status === 'branch_approved' ||
    status === 'admin_approved'
  ) {
    return 'in_progress';
  }
  return null;
}

export function filterSettlementTradeReport(
  report: ICSettlementTradeReport,
  filters: ReportFilterState,
): ICSettlementTradeReport {
  const n = normSearch(filters.search);
  const filterLine = (line: ICSettlementTradeLine): boolean => {
    if (filters.tradeType === 'purchase' && line.txnKind !== 'purchase') return false;
    if (filters.tradeType === 'sale' && line.txnKind !== 'sale') return false;

    if (line.txnKind === 'sale' && line.orderStatus) {
      if (!filters.includeVoidOrders && isVoidIcSaleOrderStatus(line.orderStatus)) return false;
      if (filters.orderStatus !== 'all') {
        const bucket = saleOrderBucket(line.orderStatus);
        if (bucket !== filters.orderStatus) return false;
      }
    }

    if (filters.warehouseId && line.warehouseId !== filters.warehouseId) return false;

    if (filters.counterpartyId && line.counterpartyId !== filters.counterpartyId) return false;

    if (n) {
      const blob = [
        line.reference,
        line.counterparty,
        line.counterpartyCode,
        line.warehouseName,
        line.warehouseCode,
        line.orderStatus,
        line.paymentStatus,
        line.notes,
      ]
        .filter(Boolean)
        .join(' ');
      if (!haystackIncludes(blob, n)) return false;
    }
    return true;
  };

  const purchases = report.purchases.filter(filterLine);
  const sales = report.sales.filter(filterLine);
  return {
    ...report,
    purchases,
    sales,
    summary: summarizeSettlementTrades(purchases, sales),
  };
}

export function filterWarehouseSummaries(
  rows: ICWarehousePLWarehouseSummary[],
  warehouseId: string,
  search: string,
): ICWarehousePLWarehouseSummary[] {
  let out = rows;
  if (warehouseId) out = out.filter(w => w.warehouseId === warehouseId);
  const n = normSearch(search);
  if (n) out = out.filter(w => haystackIncludes(w.warehouseName, n));
  return out;
}

export function filterWarehousePlLines(
  lines: ICWarehousePLLine[],
  warehouseId: string,
  search: string,
): ICWarehousePLLine[] {
  let out = lines;
  if (warehouseId) out = out.filter(l => l.warehouseId === warehouseId);
  const n = normSearch(search);
  if (!n) return out;
  return out.filter(l =>
    [l.warehouseName, l.customerName, l.saleId].some(part => haystackIncludes(String(part), n)),
  );
}

export function formatReportFilterSummary(
  filters: ReportFilterState,
  extras?: { period?: string; accountName?: string; book?: string },
): string {
  const parts: string[] = [];
  if (extras?.period) parts.push(extras.period);
  if (extras?.accountName) parts.push(`Account: ${extras.accountName}`);
  if (extras?.book) parts.push(`Book: ${extras.book}`);
  if (filters.search) parts.push(`Search: "${filters.search.trim()}"`);
  if (filters.warehouseId) parts.push('Warehouse filter applied');
  if (filters.counterpartyId) parts.push('Party filter applied');
  if (filters.tradeType !== 'all') parts.push(`Type: ${filters.tradeType}`);
  if (filters.voucherStatus !== 'all') parts.push(`Status: ${filters.voucherStatus}`);
  if (filters.expenseKind !== 'all') parts.push(`Expense: ${filters.expenseKind}`);
  if (filters.orderStatus !== 'all') parts.push(`Orders: ${filters.orderStatus}`);
  if (filters.includeVoidOrders) parts.push('Including cancelled/rejected');
  return parts.join(' · ');
}
