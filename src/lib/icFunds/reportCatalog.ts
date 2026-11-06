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
    description: 'Day-to-day debits and credits, cash movement, and expense vouchers.',
    reports: [
      {
        id: 'all-vouchers',
        title: 'Day book',
        description: 'Every AED voucher in date order. Metal in rupees is not on this page.',
      },
      {
        id: 'cash-bank',
        title: 'Cash & bank book',
        description: 'Opening, in, out, and closing for each AED till and wallet.',
      },
      {
        id: 'd-expenses',
        title: 'Expense register',
        description: 'AED expense vouchers — cost of sales and running costs.',
      },
    ],
  },
  {
    id: 'statements',
    title: 'Ledgers & balances',
    description: 'Opening and closing balances by account and party.',
    reports: [
      {
        id: 'statement',
        title: 'Statement of account',
        description:
          'One account: opening, in, out, closing. Use AED or INR tabs — the two books are never added together.',
      },
      {
        id: 'receivables',
        title: 'Receivables & payables',
        description: 'Who owes us and whom we owe, in AED. INR metal balances are on Statement (INR).',
      },
    ],
  },
  {
    id: 'financial',
    title: 'Financial statements',
    description: 'AED statements, plus metal and fund registers. AED and INR are never added together.',
    reports: [
      {
        id: 'trial-balance',
        title: 'Trial balance',
        description: 'AED accounts: opening, movement, and closing. Checks that debits equal credits.',
      },
      {
        id: 'profit-loss',
        title: 'Profit & loss',
        description:
          'AED ledger profit, or metal profit in rupees — pick a tab. The two are never added together.',
      },
      {
        id: 'balance-sheet',
        title: 'Balance sheet',
        description: 'What the business owns and owes in AED as at the end date.',
      },
      {
        id: 'fund-trades',
        title: 'Fund register (purchase & sale)',
        description: 'Cash IC buys and sells in AED — not metal.',
      },
      {
        id: 'metal-trades',
        title: 'Metal register (purchase & sale)',
        description: 'Cash metal in INR, or metal settled with an AED agent — pick a tab.',
      },
    ],
  },
  {
    id: 'operational',
    title: 'Stock & warehouse',
    description: 'Inventory movement and gross profit by warehouse.',
    reports: [
      {
        id: 'warehouse-pl',
        title: 'Warehouse statement',
        description:
          'IC units and AED profit, or metal grams with INR and AED profit shown separately — pick a tab.',
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
