export type ICFundsSectionId =
  | 'payments'
  | 'receipts'
  | 'contra'
  | 'journal'
  | 'pl'
  | 'accounts'
  | 'reports';

export type ICFundsReportId =
  | 'all-vouchers'
  | 'cash-bank'
  | 'statement'
  | 'inr-statement'
  | 'd-expenses'
  | 'profit-loss'
  | 'metal-pl'
  | 'warehouse-pl'
  | 'warehouse-metal'
  | 'balance-sheet'
  | 'receivables'
  | 'trial-balance'
  | 'fund-trades'
  | 'metal-trades'
  | 'metal-agent-trades';

export type ICFundsNavItem = {
  id: ICFundsSectionId;
  label: string;
};

export const IC_FUNDS_NAV: readonly ICFundsNavItem[] = [
  { id: 'payments', label: 'Payments' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'contra', label: 'Contra' },
  { id: 'journal', label: 'Journal' },
  { id: 'accounts', label: 'Entities' },
  { id: 'reports', label: 'Financial Reports' },
];

export const IC_FUNDS_REPORTS: ReadonlyArray<{ id: ICFundsReportId; label: string }> = [
  { id: 'all-vouchers', label: 'Day book' },
  { id: 'cash-bank', label: 'Cash & bank book' },
  { id: 'statement', label: 'Statement (AED)' },
  { id: 'inr-statement', label: 'Statement (INR)' },
  { id: 'd-expenses', label: 'Expense register' },
  { id: 'receivables', label: 'Receivables & payables' },
  { id: 'profit-loss', label: 'Profit & loss (AED)' },
  { id: 'metal-pl', label: 'Metal P&L (INR)' },
  { id: 'warehouse-pl', label: 'Warehouse IC' },
  { id: 'warehouse-metal', label: 'Warehouse metal' },
  { id: 'balance-sheet', label: 'Balance sheet' },
  { id: 'trial-balance', label: 'Trial balance' },
  { id: 'fund-trades', label: 'Fund register' },
  { id: 'metal-trades', label: 'Metal register (INR)' },
  { id: 'metal-agent-trades', label: 'Metal via AED agent' },
];

const SECTION_IDS = new Set(IC_FUNDS_NAV.map(item => item.id));
const REPORT_IDS = new Set(IC_FUNDS_REPORTS.map(item => item.id));

const LEGACY_REPORT_PATHS: Record<string, ICFundsReportId> = {
  'cash-bank': 'cash-bank',
  statement: 'statement',
  'd-expenses': 'd-expenses',
  'profit-loss': 'profit-loss',
  'balance-sheet': 'balance-sheet',
};

export function isICFundsSection(value: string): value is ICFundsSectionId {
  return SECTION_IDS.has(value as ICFundsSectionId);
}

export function isICFundsReportId(value: string | null | undefined): value is ICFundsReportId {
  return !!value && REPORT_IDS.has(value as ICFundsReportId);
}

export function legacyReportPathToView(section: string): ICFundsReportId | null {
  return LEGACY_REPORT_PATHS[section] ?? null;
}

export function icFundsPath(
  _slug: string,
  section: ICFundsSectionId,
  portal: 'admin' | 'branch' = 'admin',
): string {
  return `/admin/${section}`;
}

export function icFundsReportPath(
  _slug: string,
  view: ICFundsReportId,
  _portal: 'admin' | 'branch' = 'admin',
): string {
  return `/admin/reports?view=${view}`;
}
