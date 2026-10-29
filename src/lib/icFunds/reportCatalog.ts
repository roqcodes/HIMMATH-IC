import type { ICFundsReportId } from '@/lib/icFunds/nav';

export type ReportCatalogGroupId =
  | 'registers'
  | 'statements'
  | 'financial'
  | 'operational';

export type ReportCatalogEntry = {
  id: ICFundsReportId;
  title: string;
  description: string;
};

export const REPORT_CATALOG_GROUPS: ReadonlyArray<{
  id: ReportCatalogGroupId;
  title: string;
  description: string;
  reports: readonly ReportCatalogEntry[];
}> = [
  {
    id: 'registers',
    title: 'Books & registers',
    description: 'Chronological and cash movement registers for the period.',
    reports: [
      {
        id: 'all-vouchers',
        title: 'Day book',
        description: 'All voucher entries in date order — the general day book.',
      },
      {
        id: 'cash-bank',
        title: 'Cash & bank book',
        description: 'Opening, receipts, payments, and closing balance for each till and wallet.',
      },
      {
        id: 'd-expenses',
        title: 'Direct costs register',
        description: 'Vouchers touching direct expense accounts (including purchase cost).',
      },
    ],
  },
  {
    id: 'statements',
    title: 'Ledgers & balances',
    description: 'Account-level detail and outstanding balances as at the report date.',
    reports: [
      {
        id: 'statement',
        title: 'Account ledger',
        description: 'Opening balance, period movements, and closing balance for one account.',
      },
      {
        id: 'receivables',
        title: 'Receivables & payables',
        description: 'Trade receivables and payables from personal accounts (no aging).',
      },
    ],
  },
  {
    id: 'financial',
    title: 'Financial statements',
    description: 'Trial balance, profit & loss, and balance sheet in standard layout.',
    reports: [
      {
        id: 'trial-balance',
        title: 'Trial balance',
        description: 'Opening, period debits and credits, and closing balances by account.',
      },
      {
        id: 'profit-loss',
        title: 'Profit & loss',
        description: 'Sales, direct costs, operating expenses, and net result for the period.',
      },
      {
        id: 'balance-sheet',
        title: 'Balance sheet',
        description: 'Assets, liabilities, and equity as at the end date.',
      },
    ],
  },
  {
    id: 'operational',
    title: 'Operational analysis',
    description: 'Inventory-based gross profit — not the same as HQ ledger COGS timing.',
    reports: [
      {
        id: 'warehouse-pl',
        title: 'Warehouse gross profit',
        description: 'Weighted-average COGS on completed deliveries by warehouse.',
      },
    ],
  },
];

export function reportCatalogTitle(id: ICFundsReportId): string {
  for (const group of REPORT_CATALOG_GROUPS) {
    const hit = group.reports.find(r => r.id === id);
    if (hit) return hit.title;
  }
  return id;
}

/** Hub layout: left / right columns (horizontal split on md+). */
export const REPORT_HUB_COLUMNS: ReadonlyArray<{
  id: 'left' | 'right';
  heading: string;
  groupIds: readonly ReportCatalogGroupId[];
}> = [
  {
    id: 'left',
    heading: 'Registers & ledgers',
    groupIds: ['registers', 'statements'],
  },
  {
    id: 'right',
    heading: 'Statements & analysis',
    groupIds: ['financial', 'operational'],
  },
];

export function reportCatalogGroup(id: ReportCatalogGroupId) {
  return REPORT_CATALOG_GROUPS.find(g => g.id === id);
}
