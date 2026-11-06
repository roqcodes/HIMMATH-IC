import type { ICFundsReportId } from '@/lib/icFunds/nav';

export type ReportCatalogBookId = 'ic-aed' | 'metal-inr';

export type ReportCatalogGroupId =
  | 'registers-ic'
  | 'registers-metal'
  | 'analysis-ic'
  | 'analysis-metal';

export type ReportCatalogEntry = {
  id: ICFundsReportId;
  title: string;
  description: string;
};

export type ReportCatalogGroup = {
  id: ReportCatalogGroupId;
  book: ReportCatalogBookId;
  title: string;
  description: string;
  reports: readonly ReportCatalogEntry[];
};

export const REPORT_CATALOG_GROUPS: readonly ReportCatalogGroup[] = [
  {
    id: 'registers-ic',
    book: 'ic-aed',
    title: 'IC / Fund (AED)',
    description: 'HQ ledger in AED — cash IC deals, bank, expenses, and party balances.',
    reports: [
      {
        id: 'all-vouchers',
        title: 'Day book',
        description: 'Every AED debit and credit in date order.',
      },
      {
        id: 'cash-bank',
        title: 'Cash & bank book',
        description: 'Opening, receipts, payments, and closing for each till (AED).',
      },
      {
        id: 'd-expenses',
        title: 'Expense register',
        description: 'Operating and direct expense vouchers on the AED ledger.',
      },
      {
        id: 'statement',
        title: 'Statement of account (AED)',
        description: 'Opening, movements, and closing for one IC Funds account.',
      },
      {
        id: 'receivables',
        title: 'Receivables & payables',
        description: 'Customer and supplier AED balances (includes AED agents).',
      },
    ],
  },
  {
    id: 'registers-metal',
    book: 'metal-inr',
    title: 'Metal (INR)',
    description: 'Commodity book in INR — cash metal purchases, sales, and supplier balances.',
    reports: [
      {
        id: 'inr-statement',
        title: 'Statement of account (INR)',
        description: 'Opening, movements, and closing on the INR metal ledger.',
      },
    ],
  },
  {
    id: 'analysis-ic',
    book: 'ic-aed',
    title: 'IC / Fund (AED)',
    description: 'Financial statements and IC unit activity in AED.',
    reports: [
      {
        id: 'trial-balance',
        title: 'Trial balance',
        description: 'AED accounts — opening, period Dr/Cr, and closing.',
      },
      {
        id: 'profit-loss',
        title: 'Profit & loss (AED)',
        description: 'IC cash WAC gross profit and operating result on the AED ledger.',
      },
      {
        id: 'balance-sheet',
        title: 'Balance sheet',
        description: 'AED assets, liabilities, and equity as at the end date.',
      },
      {
        id: 'fund-trades',
        title: 'Fund register',
        description: 'IC unit purchases and sales — amounts in AED only.',
      },
      {
        id: 'warehouse-pl',
        title: 'Warehouse IC',
        description: 'IC units in/out and WAC gross profit by warehouse (AED).',
      },
      {
        id: 'metal-agent-trades',
        title: 'Metal via AED agent',
        description: 'Agent settlement for metal deals — AED only, not commodity P&L.',
      },
    ],
  },
  {
    id: 'analysis-metal',
    book: 'metal-inr',
    title: 'Metal (INR)',
    description: 'Grams, INR values, and commodity profit on the metal book.',
    reports: [
      {
        id: 'metal-trades',
        title: 'Metal register (cash)',
        description: 'Cash-metal buys and sells — grams and INR only.',
      },
      {
        id: 'warehouse-metal',
        title: 'Warehouse metal',
        description: 'Fine metal in/out and period P&L by warehouse (INR).',
      },
      {
        id: 'metal-pl',
        title: 'Metal profit & loss',
        description: 'INR ledger: metal sales, cost of metal sold, and net result.',
      },
    ],
  },
];

export const REPORT_HUB_COLUMNS: ReadonlyArray<{
  id: 'left' | 'right';
  heading: string;
  groupIds: readonly ReportCatalogGroupId[];
}> = [
  {
    id: 'left',
    heading: 'Registers & ledgers',
    groupIds: ['registers-ic', 'registers-metal'],
  },
  {
    id: 'right',
    heading: 'Statements & analysis',
    groupIds: ['analysis-ic', 'analysis-metal'],
  },
];

export function reportCatalogTitle(id: ICFundsReportId): string {
  for (const group of REPORT_CATALOG_GROUPS) {
    const hit = group.reports.find(r => r.id === id);
    if (hit) return hit.title;
  }
  return id;
}

export function reportCatalogBook(id: ICFundsReportId): ReportCatalogBookId | null {
  for (const group of REPORT_CATALOG_GROUPS) {
    if (group.reports.some(r => r.id === id)) return group.book;
  }
  return null;
}

export function reportCatalogGroup(id: ReportCatalogGroupId): ReportCatalogGroup | undefined {
  return REPORT_CATALOG_GROUPS.find(g => g.id === id);
}
