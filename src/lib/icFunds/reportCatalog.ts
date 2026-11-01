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
        description: 'Vouchers on direct expense accounts — mainly WAC COGS when IC sales complete.',
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
        description:
          'Ledger P&L in AED: cash IC WAC COGS, metal AED lot results, operating expenses. Metal INR profit is on warehouse GP and the metal register.',
      },
      {
        id: 'balance-sheet',
        title: 'Balance sheet',
        description:
          'Assets (cash, receivables, IC inventory), liabilities, and equity as at the end date.',
      },
      {
        id: 'fund-trades',
        title: 'Fund purchase & sales',
        description:
          'Cash (AED fund) IC buy/sell register — date, counterparty, units, rates, amounts, and settlement status.',
      },
      {
        id: 'metal-trades',
        title: 'Metal purchase & sales',
        description:
          'Metal lots: grams, G rate, sheet RATE, INR/AED totals, and booked P&L in the sale pay currency.',
      },
    ],
  },
  {
    id: 'operational',
    title: 'Operational analysis',
    description: 'IC unit WAC gross profit plus metal lot P&L (AED and INR) by warehouse.',
    reports: [
      {
        id: 'warehouse-pl',
        title: 'Warehouse gross profit',
        description:
          'Cash IC WAC gross profit and metal lot P&L (AED / INR) by warehouse for the selected period.',
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
