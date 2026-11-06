import type { AsicKpiMetric } from '@/components/asic/AsicKpiStrip';
import type { ICFundVoucherRangeStats } from '@/app/actions/icFundsActions';
import type { ICFundAccountType, ICFundVoucher, ICFundVoucherType } from '@/types';
import { fmtLedgerAed, fmtLedgerInr } from '@/lib/icFunds/format';
import { ledgerAedNode, ledgerInrNode } from '@/lib/icFunds/formatDisplay';
import { formatMetalPlKpi } from '@/lib/icTransfer/inventoryKpiMetrics';
import type { ICFundAccountDetailStats } from '@/lib/icFunds/accountDetailAnalytics';
import type { ICFundsReportId } from '@/lib/icFunds/nav';
import type { ICWarehousePLReport } from '@/lib/icFunds/warehouseProfit';
import type { ICSettlementTradeReport } from '@/lib/icFunds/settlementTradeReport';
import type { ICFundAccount, ICFundTrialBalanceLine } from '@/types';

import type { PlStatement } from '@/lib/icFunds/reportPresentation';

type ProfitLossSummary = {
  income: number;
  profit: number;
  expense: number;
  dExpense: number;
  net: number;
};

function computeInrPlKpisFromStatement(statement: PlStatement): AsicKpiMetric[] {
  return [
    {
      label: 'Metal sales',
      value: ledgerInrNode(statement.salesTotal),
      hint: 'Income plus transfers to reserve',
      tone: statement.salesTotal > 0 ? 'emerald' : 'slate',
    },
    {
      label: 'Cost of metal',
      value: ledgerInrNode(statement.directCostsTotal),
      hint: 'COGS on completed cash-metal sales',
      tone: statement.directCostsTotal > 0 ? 'red' : 'slate',
    },
    {
      label: 'Gross result',
      value: ledgerInrNode(statement.grossResult),
      hint: 'Sales less cost of metal sold',
      tone: statement.grossResult >= 0 ? 'emerald' : 'red',
    },
    {
      label: 'Net result (INR)',
      value: ledgerInrNode(statement.netForPeriod),
      hint: 'Metal commodity ledger',
      tone: statement.netForPeriod >= 0 ? 'emerald' : 'red',
    },
  ];
}

function computePlKpisFromStatement(statement: PlStatement, voucherCount?: number): AsicKpiMetric[] {
  const metrics: AsicKpiMetric[] = [
    {
      label: 'Sales',
      value: ledgerAedNode(statement.salesTotal),
      hint: 'Income plus transfers to reserve',
      tone: statement.salesTotal > 0 ? 'emerald' : 'slate',
    },
    {
      label: 'Direct costs',
      value: ledgerAedNode(statement.directCostsTotal),
      hint: 'COGS on completed sales (WAC); unsold stock stays in inventory',
      tone: statement.directCostsTotal > 0 ? 'red' : 'slate',
    },
    {
      label: 'Gross result',
      value: ledgerAedNode(statement.grossResult),
      hint: 'Sales less direct costs',
      tone: statement.grossResult >= 0 ? 'emerald' : 'red',
    },
    {
      label: 'Net result',
      value: ledgerAedNode(statement.netForPeriod),
      hint:
        voucherCount != null
          ? `${voucherCount} P&L ${voucherCount === 1 ? 'voucher' : 'vouchers'} in period`
          : 'After operating expenses',
      tone: statement.netForPeriod >= 0 ? 'emerald' : 'red',
    },
  ];
  return metrics;
}

type BalanceSheetSummary = {
  bank: number;
  receivables: number;
  payables: number;
  equity: number;
  inventoryOnHand?: number;
  accumulatedPL: number;
  totalAssets: number;
  totalLiabilitiesEquity: number;
  balanced: boolean;
  outOfBalance?: number;
};

function sumAbsPending(accounts: ICFundAccount[]): { total: number; count: number } {
  let total = 0;
  let count = 0;
  for (const account of accounts) {
    const pending = Math.abs(account.pendingBalance ?? 0);
    if (pending > 0.005) {
      total += pending;
      count += 1;
    }
  }
  return { total, count };
}

function rollupVouchers(vouchers: ICFundVoucher[]) {
  let posted = 0;
  let postedTotal = 0;
  let pending = 0;
  let pendingTotal = 0;
  let voided = 0;

  for (const voucher of vouchers) {
    if (voucher.status === 'void') {
      voided += 1;
      continue;
    }
    if (voucher.status === 'pending') {
      pending += 1;
      pendingTotal += voucher.amount;
      continue;
    }
    posted += 1;
    postedTotal += voucher.amount;
  }

  return { posted, postedTotal, pending, pendingTotal, voided };
}

const VOUCHER_TOTAL_LABELS: Record<
  ICFundVoucherType,
  { total: string; totalHint: string; postedHint: string }
> = {
  payment: {
    total: 'Paid out',
    totalHint: 'Posted payments in range',
    postedHint: 'Active payment vouchers',
  },
  receipt: {
    total: 'Received',
    totalHint: 'Posted receipts in range',
    postedHint: 'Active receipt vouchers',
  },
  journal: {
    total: 'Journal value',
    totalHint: 'Posted journal amounts',
    postedHint: 'Active journal entries',
  },
  contra: {
    total: 'Transferred',
    totalHint: 'Posted contra amounts',
    postedHint: 'Active contra entries',
  },
};

export function computeAccountsKpis(
  accounts: ICFundAccount[],
  _hqMode?: boolean,
  entityLedger = false,
): AsicKpiMetric[] {
  const active = accounts.filter(a => a.status === 'active');
  const inactive = accounts.length - active.length;
  const bankAccounts = accounts.filter(a => a.accountType === 'bank');
  const cashBank = bankAccounts.reduce((sum, a) => sum + a.balance, 0);
  const personal = accounts.filter(a => a.accountType === 'personal');
  const receivableRows = personal.filter(a => a.balance > 0);
  const payableRows = personal.filter(a => a.balance < 0);
  const receivables = receivableRows.reduce((sum, a) => sum + a.balance, 0);
  const payables = payableRows.reduce((sum, a) => sum + Math.abs(a.balance), 0);
  const pending = sumAbsPending(accounts);

  const metrics: AsicKpiMetric[] = [
    {
      label: 'Cash & bank',
      value: ledgerAedNode(cashBank),
      hint: `${bankAccounts.length} tills & wallets`,
      tone: cashBank < 0 ? 'red' : 'emerald',
    },
  ];

  if (!entityLedger) {
    metrics.push(
      {
        label: 'Receivables',
        value: ledgerAedNode(receivables),
        hint: `${receivableRows.length} customers owe us`,
      },
      {
        label: 'Payables',
        value: ledgerAedNode(payables),
        hint: `${payableRows.length} balances we owe`,
        tone: payables > 0 ? 'amber' : 'slate',
      },
    );
  }

  metrics.push(
    pending.count > 0
      ? {
          label: 'Pending approval',
          value: ledgerAedNode(pending.total),
          hint: `${pending.count} awaiting activation`,
          tone: 'amber',
        }
      : {
          label: entityLedger ? 'Active entities' : 'Active accounts',
          value: active.length.toLocaleString(),
          hint: inactive > 0
            ? `${inactive} inactive`
            : entityLedger
              ? 'All entities active'
              : 'All accounts active',
          tone: 'slate',
        },
  );

  return metrics;
}

export function computeVoucherKpis(
  stats: ICFundVoucherRangeStats,
  voucherType: ICFundVoucherType,
): AsicKpiMetric[] {
  const labels = VOUCHER_TOTAL_LABELS[voucherType];
  const pendingMetric: AsicKpiMetric =
    stats.pending > 0
      ? {
          label: 'Awaiting approval',
          value: ledgerAedNode(stats.pendingTotal),
          hint: `${stats.pending} pending ${stats.pending === 1 ? 'entry' : 'entries'}`,
          tone: 'amber',
        }
      : {
          label: 'Largest entry',
          value: stats.largest > 0 ? ledgerAedNode(stats.largest) : '—',
          valueTitle: stats.largest > 0 ? fmtLedgerAed(stats.largest) : undefined,
          hint: 'Biggest posted amount',
        };

  return [
    {
      label: labels.total,
      value: ledgerAedNode(stats.total),
      hint: labels.totalHint,
      tone: 'emerald',
    },
    {
      label: 'Posted',
      value: stats.posted.toLocaleString(),
      hint: labels.postedHint,
    },
    pendingMetric,
    {
      label: 'Voided',
      value: stats.voided.toLocaleString(),
      hint: 'Excluded from balances',
      tone: stats.voided > 0 ? 'red' : 'slate',
    },
  ];
}

export function computePlKpis(summary: ProfitLossSummary, voucherCount?: number): AsicKpiMetric[] {
  const totalCosts = summary.expense + summary.dExpense;
  const margin =
    summary.income > 0 ? `${((summary.net / summary.income) * 100).toFixed(1)}%` : '—';

  return [
    {
      label: 'Income',
      value: ledgerAedNode(summary.income),
      hint: 'Revenue credited in period',
      tone: summary.income > 0 ? 'emerald' : 'slate',
    },
    {
      label: 'Total costs',
      value: ledgerAedNode(totalCosts),
      hint: `Op ${fmtLedgerAed(summary.expense)} · Direct ${fmtLedgerAed(summary.dExpense)}`,
      tone: totalCosts > 0 ? 'red' : 'slate',
    },
    {
      label: 'Net result',
      value: ledgerAedNode(summary.net),
      hint: summary.net >= 0 ? 'Profit for the period' : 'Loss for the period',
      tone: summary.net >= 0 ? 'emerald' : 'red',
    },
    {
      label: 'Margin',
      value: margin,
      hint:
        voucherCount != null
          ? `${voucherCount} P&L ${voucherCount === 1 ? 'entry' : 'entries'} · net ÷ income`
          : 'Net result ÷ income',
      tone: summary.net >= 0 && summary.income > 0 ? 'indigo' : 'slate',
    },
  ];
}

export function computeBooksKpis(input: {
  reportView: ICFundsReportId;
  profitLoss?: ProfitLossSummary;
  plStatement?: PlStatement;
  balanceSheet?: BalanceSheetSummary;
  trialBalance?: ICFundTrialBalanceLine[];
  vouchers?: ICFundVoucher[];
  cashBank?: ICFundAccount[];
  receivables?: ICFundAccount[];
  payables?: ICFundAccount[];
  warehousePl?: ICWarehousePLReport | null;
  settlementTradeReport?: ICSettlementTradeReport | null;
  statement?: {
    opening: number;
    closing: number;
    currency?: 'AED' | 'INR';
    lines: Array<{ debit: number; credit: number; status?: string }>;
  } | null;
  warehouseBook?: 'ic' | 'metal';
}): AsicKpiMetric[] {
  const {
    reportView,
    profitLoss,
    plStatement,
    balanceSheet,
    trialBalance = [],
    vouchers = [],
    cashBank = [],
    receivables = [],
    payables = [],
    warehousePl,
    settlementTradeReport,
    statement,
    warehouseBook,
  } = input;

  if (reportView === 'metal-pl' && plStatement) {
    return computeInrPlKpisFromStatement(plStatement);
  }

  if (reportView === 'profit-loss' && plStatement) {
    return computePlKpisFromStatement(plStatement, vouchers.length);
  }

  if (reportView === 'profit-loss' && profitLoss) {
    return computePlKpis(profitLoss, vouchers.length);
  }

  if (reportView === 'balance-sheet' && balanceSheet) {
    const ob = balanceSheet.outOfBalance ?? 0;
    const inventory = balanceSheet.inventoryOnHand ?? 0;
    return [
      {
        label: 'Total assets',
        value: ledgerAedNode(balanceSheet.totalAssets),
        hint:
          inventory > 0.005
            ? `Cash ${fmtLedgerAed(balanceSheet.bank)} · AR ${fmtLedgerAed(balanceSheet.receivables)} · IC stock ${fmtLedgerAed(inventory)}`
            : `Cash ${fmtLedgerAed(balanceSheet.bank)} · AR ${fmtLedgerAed(balanceSheet.receivables)}`,
        tone: 'emerald',
      },
      {
        label: 'Liabilities',
        value: ledgerAedNode(balanceSheet.payables),
        hint: 'Trade payables',
        tone: balanceSheet.payables > 0 ? 'amber' : 'slate',
      },
      {
        label: 'Equity',
        value: ledgerAedNode(balanceSheet.totalLiabilitiesEquity - balanceSheet.payables),
        hint: 'Reserve + current period',
        tone: 'indigo',
      },
      {
        label: balanceSheet.balanced ? 'Balanced' : 'Out of balance',
        value: balanceSheet.balanced ? 'Yes' : ledgerAedNode(Math.abs(ob)),
        valueTitle: balanceSheet.balanced ? 'Yes' : fmtLedgerAed(Math.abs(ob)),
        hint: balanceSheet.balanced
          ? 'Assets = liabilities + equity'
          : 'Review opening balances or journals',
        tone: balanceSheet.balanced ? 'emerald' : 'red',
      },
    ];
  }

  if (reportView === 'trial-balance') {
    const debit = trialBalance.reduce((sum, line) => sum + (line.closingDebit ?? line.debit), 0);
    const credit = trialBalance.reduce((sum, line) => sum + (line.closingCredit ?? line.credit), 0);
    const pendingDr = trialBalance.reduce((sum, line) => sum + (line.pendingDebit ?? 0), 0);
    const pendingCr = trialBalance.reduce((sum, line) => sum + (line.pendingCredit ?? 0), 0);
    const diff = Math.abs(debit - credit);

    return [
      {
        label: 'Total debits',
        value: ledgerAedNode(debit),
        hint: `${trialBalance.length} accounts with balance`,
      },
      {
        label: 'Total credits',
        value: ledgerAedNode(credit),
        hint: 'Posted trial balance',
      },
      {
        label: 'Difference',
        value: diff < 0.01 ? '—' : ledgerAedNode(diff),
        valueTitle: diff < 0.01 ? undefined : fmtLedgerAed(diff),
        hint: diff < 0.01 ? 'Debits equal credits' : 'Out of balance',
        tone: diff < 0.01 ? 'emerald' : 'red',
      },
      {
        label: 'Pending',
        value: ledgerAedNode(pendingDr + pendingCr),
        hint: `Dr ${fmtLedgerAed(pendingDr)} · Cr ${fmtLedgerAed(pendingCr)}`,
        tone: pendingDr + pendingCr > 0 ? 'amber' : 'slate',
      },
    ];
  }

  if (reportView === 'cash-bank') {
    const total = cashBank.reduce((sum, account) => sum + account.balance, 0);
    const pending = sumAbsPending(cashBank);
    const largest = cashBank.reduce(
      (best, account) => (account.balance > best.balance ? account : best),
      cashBank[0] ?? { balance: 0, name: '' },
    );

    return [
      {
        label: 'Cash & bank',
        value: ledgerAedNode(total),
        hint: `${cashBank.length} accounts`,
        tone: total < 0 ? 'red' : 'emerald',
      },
      {
        label: 'Largest till',
        value: largest ? ledgerAedNode(largest.balance) : '—',
        valueTitle: largest ? fmtLedgerAed(largest.balance) : undefined,
        hint: largest?.name ? largest.name : 'No bank accounts',
      },
      {
        label: 'Negative balances',
        value: cashBank.filter(a => a.balance < 0).length.toLocaleString(),
        hint: 'Accounts overdrawn',
        tone: cashBank.some(a => a.balance < 0) ? 'red' : 'slate',
      },
      pending.count > 0
        ? {
            label: 'Pending',
            value: ledgerAedNode(pending.total),
            hint: `${pending.count} accounts awaiting approval`,
            tone: 'amber',
          }
        : {
            label: 'Zero balance',
            value: cashBank.filter(a => Math.abs(a.balance) < 0.01).length.toLocaleString(),
            hint: 'Empty tills & wallets',
            tone: 'slate',
          },
    ];
  }

  if (reportView === 'receivables') {
    const ar = receivables.reduce((sum, account) => sum + account.balance, 0);
    const ap = payables.reduce((sum, account) => sum + Math.abs(account.balance), 0);

    return [
      {
        label: 'Receivables',
        value: ledgerAedNode(ar),
        hint: `${receivables.length} customers owe us`,
      },
      {
        label: 'Payables',
        value: ledgerAedNode(ap),
        hint: `${payables.length} balances we owe`,
        tone: ap > 0 ? 'amber' : 'slate',
      },
      {
        label: 'Net personal',
        value: ledgerAedNode(ar - ap),
        hint: 'Receivables minus payables',
        tone: ar - ap >= 0 ? 'emerald' : 'red',
      },
      {
        label: 'With pending',
        value: [...receivables, ...payables].filter(a => Math.abs(a.pendingBalance ?? 0) > 0.005).length.toLocaleString(),
        hint: 'Accounts with unposted vouchers',
        tone: 'indigo',
      },
    ];
  }

  if (
    (reportView === 'fund-trades' ||
      reportView === 'metal-trades' ||
      reportView === 'metal-agent-trades') &&
    settlementTradeReport
  ) {
    const s = settlementTradeReport.summary;
    if (reportView === 'metal-agent-trades') {
      return [
        {
          label: 'Purchase (AED)',
          value: ledgerAedNode(s.purchaseAed),
          hint: `${s.purchaseCount} agent settlements`,
          tone: 'amber',
        },
        {
          label: 'Sales (AED)',
          value: ledgerAedNode(s.saleAed),
          hint: `${s.saleCount} agent collections`,
          tone: 'emerald',
        },
        {
          label: 'Net settlement',
          value: ledgerAedNode(s.saleAed - s.purchaseAed),
          hint: 'Agent book — not INR metal profit',
          tone: s.saleAed - s.purchaseAed >= 0 ? 'emerald' : 'red',
        },
        {
          label: 'Fine metal (g)',
          value: s.metalWeightSoldG.toLocaleString(undefined, { maximumFractionDigits: 2 }),
          hint: 'Quantity memo on agent deals',
          tone: 'slate',
        },
      ];
    }
    if (reportView === 'metal-trades') {
      return [
        {
          label: 'INR purchased',
          value: ledgerInrNode(s.purchaseInr),
          valueTitle: fmtLedgerInr(s.purchaseInr),
          hint: `${s.purchaseCount} cash-metal buys · ${s.metalWeightPurchasedG.toLocaleString(undefined, { maximumFractionDigits: 2 })} g`,
          tone: 'indigo',
        },
        {
          label: 'INR sold',
          value: ledgerInrNode(s.saleInr),
          valueTitle: fmtLedgerInr(s.saleInr),
          hint: `${s.saleCount} cash-metal sells · ${s.metalWeightSoldG.toLocaleString(undefined, { maximumFractionDigits: 2 })} g`,
          tone: 'slate',
        },
        {
          label: 'Metal P&L (INR)',
          ...formatMetalPlKpi({
            metalProfitAed: 0,
            metalProfitInr: s.bookedInrProfit,
            rangeLabel: `${s.metalWeightSoldG.toLocaleString(undefined, { maximumFractionDigits: 2 })} g sold`,
          }),
        },
        {
          label: 'Total entries',
          value: (s.purchaseCount + s.saleCount).toLocaleString(),
          hint: 'Buy + sell lines',
          tone: 'indigo',
        },
      ];
    }
    return [
      {
        label: 'Purchase (fund)',
        value: ledgerAedNode(s.purchaseAed),
        hint: `${s.purchaseCount} entries · ${s.purchaseUnits.toLocaleString(undefined, { maximumFractionDigits: 2 })} units`,
        tone: 'amber',
      },
      {
        label: 'Sales (fund)',
        value: ledgerAedNode(s.saleAed),
        hint: `${s.saleCount} entries · ${s.saleUnits.toLocaleString(undefined, { maximumFractionDigits: 2 })} units`,
        tone: 'emerald',
      },
      {
        label: 'Net movement',
        value: ledgerAedNode(s.saleAed - s.purchaseAed),
        hint: 'Cash AED in minus out — not gross profit (see P&L / warehouse GP)',
        tone: s.saleAed - s.purchaseAed >= 0 ? 'emerald' : 'red',
      },
      {
        label: 'Total entries',
        value: (s.purchaseCount + s.saleCount).toLocaleString(),
        hint: 'Buy + sell lines in register',
        tone: 'indigo',
      },
    ];
  }

  if (reportView === 'warehouse-pl' && warehousePl && warehouseBook !== 'metal') {
    const t = warehousePl.totals;
    return [
      {
        label: 'IC revenue',
        value: ledgerAedNode(t.revenue),
        hint: `${t.saleUnits.toLocaleString(undefined, { maximumFractionDigits: 2 })} cash IC units sold`,
        tone: 'emerald',
      },
      {
        label: 'IC gross profit',
        value: ledgerAedNode(t.grossProfit),
        hint: `COGS ${fmtLedgerAed(t.cogs)} · WAC`,
        tone: t.grossProfit >= 0 ? 'emerald' : 'red',
      },
      {
        label: 'Warehouses',
        value: warehousePl.warehouses.length.toLocaleString(),
        hint: 'With IC activity in period',
        tone: 'slate',
      },
      {
        label: 'Closing units',
        value: warehousePl.warehouses
          .reduce((sum, w) => sum + w.closingUnits, 0)
          .toLocaleString(undefined, { maximumFractionDigits: 2 }),
        hint: 'IC stock across warehouses',
        tone: 'indigo',
      },
    ];
  }

  if (reportView === 'warehouse-metal' && warehousePl && warehouseBook === 'metal') {
    const t = warehousePl.totals;
    return [
      {
        label: 'Metal sold (g)',
        value: t.metalSoldG.toLocaleString(undefined, { maximumFractionDigits: 2 }),
        hint: 'Fine metal out in period',
        tone: 'slate',
      },
      {
        label: 'Metal P&L (INR)',
        ...formatMetalPlKpi({
          metalProfitAed: 0,
          metalProfitInr: t.metalProfitInr,
          rangeLabel: `${t.metalSoldG.toLocaleString(undefined, { maximumFractionDigits: 2 })} g sold`,
        }),
      },
      {
        label: 'Warehouses',
        value: warehousePl.warehouses.length.toLocaleString(),
        hint: 'With metal activity in period',
        tone: 'slate',
      },
      {
        label: 'Metal in (g)',
        value: warehousePl.warehouses
          .reduce((sum, w) => sum + w.metalInG, 0)
          .toLocaleString(undefined, { maximumFractionDigits: 2 }),
        hint: 'Purchases into stock',
        tone: 'indigo',
      },
    ];
  }

  if ((reportView === 'statement' || reportView === 'inr-statement') && statement) {
    const postedLines = statement.lines.filter(line => line.status !== 'pending');
    const periodDr = postedLines.reduce((sum, line) => sum + line.debit, 0);
    const periodCr = postedLines.reduce((sum, line) => sum + line.credit, 0);
    const pending = statement.lines.filter(line => line.status === 'pending').length;
    const inrBook = statement.currency === 'INR';
    const fmtOpen = inrBook ? ledgerInrNode(statement.opening) : ledgerAedNode(statement.opening);
    const fmtClose = inrBook ? ledgerInrNode(statement.closing) : ledgerAedNode(statement.closing);
    const fmtDr = inrBook ? ledgerInrNode(periodDr) : ledgerAedNode(periodDr);
    const fmtCr = inrBook ? ledgerInrNode(periodCr) : ledgerAedNode(periodCr);

    return [
      {
        label: 'Opening',
        value: fmtOpen,
        hint: 'Balance before period',
      },
      {
        label: 'Period debits',
        value: fmtDr,
        hint: `${postedLines.length} posted lines`,
      },
      {
        label: 'Period credits',
        value: fmtCr,
        hint: pending > 0 ? `${pending} pending lines excluded` : 'Posted credits in range',
        tone: periodCr > 0 ? 'amber' : 'slate',
      },
      {
        label: 'Closing',
        value: fmtClose,
        hint: 'Balance after period',
        tone: statement.closing >= 0 ? 'emerald' : 'red',
      },
    ];
  }

  if (reportView === 'd-expenses') {
    const rollup = rollupVouchers(vouchers);
    return [
      {
        label: 'Expense total',
        value: ledgerAedNode(rollup.postedTotal),
        hint: 'Direct COGS and operating expenses in view',
        tone: 'red',
      },
      {
        label: 'Vouchers',
        value: rollup.posted.toLocaleString(),
        hint: `${rollup.pending} pending · ${rollup.voided} voided`,
      },
      {
        label: 'Pending',
        value: rollup.pending > 0 ? ledgerAedNode(rollup.pendingTotal) : '—',
        valueTitle: rollup.pending > 0 ? fmtLedgerAed(rollup.pendingTotal) : undefined,
        hint: rollup.pending > 0 ? `${rollup.pending} awaiting approval` : 'Nothing pending',
        tone: rollup.pending > 0 ? 'amber' : 'slate',
      },
      {
        label: 'Largest',
        value:
          rollup.posted > 0
            ? ledgerAedNode(Math.max(...vouchers.filter(v => v.status === 'active').map(v => v.amount), 0))
            : '—',
        valueTitle:
          rollup.posted > 0
            ? fmtLedgerAed(Math.max(...vouchers.filter(v => v.status === 'active').map(v => v.amount), 0))
            : undefined,
        hint: 'Biggest posted voucher',
      },
    ];
  }

  const rollup = rollupVouchers(vouchers);
  return [
    {
      label: 'Posted value',
      value: ledgerAedNode(rollup.postedTotal),
      hint: `${rollup.posted} active vouchers`,
      tone: 'emerald',
    },
    {
      label: 'All vouchers',
      value: (rollup.posted + rollup.pending).toLocaleString(),
      hint: `${rollup.voided} voided in period`,
    },
    {
      label: 'Pending',
      value: rollup.pending > 0 ? ledgerAedNode(rollup.pendingTotal) : '—',
      valueTitle: rollup.pending > 0 ? fmtLedgerAed(rollup.pendingTotal) : undefined,
      hint: rollup.pending > 0 ? `${rollup.pending} awaiting approval` : 'Nothing pending',
      tone: rollup.pending > 0 ? 'amber' : 'slate',
    },
    {
      label: 'Largest',
      value:
        rollup.posted > 0
          ? ledgerAedNode(Math.max(...vouchers.filter(v => v.status === 'active').map(v => v.amount), 0))
          : '—',
      valueTitle:
        rollup.posted > 0
          ? fmtLedgerAed(Math.max(...vouchers.filter(v => v.status === 'active').map(v => v.amount), 0))
          : undefined,
      hint: 'Biggest posted voucher',
    },
  ];
}

function fmtAmount(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function computeAccountDetailKpis(
  accountType: ICFundAccountType,
  stats: ICFundAccountDetailStats,
  balance: number,
  openingBalance: number,
  pendingBalance = 0,
  walletCurrency?: string | null,
): AsicKpiMetric[] {
  const netFlow = stats.totalDebit - stats.totalCredit;
  const topCounterparty = stats.topCounterparties[0];

  switch (accountType) {
    case 'bank':
      return [
        {
          label: 'Balance',
          value: fmtAmount(balance),
          hint: 'Cash on hand now',
          tone: balance < 0 ? 'red' : 'emerald',
        },
        {
          label: 'Money in',
          value: fmtAmount(stats.totalDebit),
          hint: 'Debits to this till',
        },
        {
          label: 'Money out',
          value: fmtAmount(stats.totalCredit),
          hint: 'Credits from this till',
          tone: stats.totalCredit > 0 ? 'amber' : 'slate',
        },
        {
          label: 'Net movement',
          value: fmtAmount(netFlow),
          hint: 'In minus out (excl. opening)',
          tone: netFlow >= 0 ? 'emerald' : 'red',
        },
      ];
    case 'personal': {
      const items: AsicKpiMetric[] = [
        {
          label: 'Balance',
          value: fmtAmount(balance),
          hint: balance > 0 ? 'Customer owes us' : balance < 0 ? 'We owe customer' : 'Settled',
          tone: balance > 0 ? 'emerald' : balance < 0 ? 'red' : 'slate',
        },
        {
          label: 'Receipts',
          value: fmtAmount(stats.receiptTotal),
          hint: 'Money received in period',
          tone: 'emerald',
        },
        {
          label: 'Payments',
          value: fmtAmount(stats.paymentTotal),
          hint: 'Money paid out in period',
          tone: stats.paymentTotal > 0 ? 'amber' : 'slate',
        },
      ];
      if (pendingBalance !== 0) {
        items.push({
          label: 'Pending',
          value: fmtAmount(pendingBalance),
          hint: 'Awaiting voucher activation',
          tone: 'amber',
        });
      } else {
        items.push({
          label: 'Opening',
          value: fmtAmount(openingBalance),
          hint: 'Balance before activity',
        });
      }
      return items;
    }
    case 'income':
      return [
        {
          label: 'Income booked',
          value: fmtAmount(stats.totalCredit),
          hint: 'Credits in period',
          tone: 'emerald',
        },
        {
          label: 'Reversals',
          value: fmtAmount(stats.totalDebit),
          hint: 'Debits against income',
          tone: stats.totalDebit > 0 ? 'amber' : 'slate',
        },
        {
          label: 'Account balance',
          value: fmtAmount(balance),
          hint: 'Accumulated income position',
        },
        {
          label: 'Top source',
          value: topCounterparty ? fmtAmount(topCounterparty.amount) : '—',
          hint: topCounterparty?.name ?? 'No counterparty activity',
          tone: 'indigo',
        },
      ];
    case 'profit':
      return [
        {
          label: 'Profit parked',
          value: fmtAmount(balance),
          hint: 'Equity reserve balance',
          tone: 'indigo',
        },
        {
          label: 'Added',
          value: fmtAmount(stats.totalCredit),
          hint: 'Profit transferred in',
          tone: 'emerald',
        },
        {
          label: 'Moved out',
          value: fmtAmount(stats.totalDebit),
          hint: 'Profit transferred out',
          tone: stats.totalDebit > 0 ? 'amber' : 'slate',
        },
        {
          label: 'Vouchers',
          value: stats.voucherCount.toLocaleString(),
          hint: 'Entries touching this account',
        },
      ];
    case 'expense':
    case 'd_expense':
      return [
        {
          label: 'Period spend',
          value: fmtAmount(stats.totalDebit),
          hint: accountType === 'd_expense' ? 'Direct deal costs' : 'Operating charges',
          tone: 'red',
        },
        {
          label: 'Reversals',
          value: fmtAmount(stats.totalCredit),
          hint: 'Credits / adjustments',
          tone: stats.totalCredit > 0 ? 'amber' : 'slate',
        },
        {
          label: 'Account balance',
          value: fmtAmount(balance),
          hint: 'Accumulated expense position',
        },
        {
          label: 'Top payee',
          value: topCounterparty ? fmtAmount(topCounterparty.amount) : '—',
          hint: topCounterparty?.name ?? 'No counterparty activity',
          tone: 'indigo',
        },
      ];
    default:
      return [
        {
          label: 'Balance',
          value: fmtAmount(balance),
          hint: `Opening ${fmtAmount(openingBalance)}`,
        },
        {
          label: 'Debits',
          value: fmtAmount(stats.totalDebit),
          hint: 'Total debits in period',
        },
        {
          label: 'Credits',
          value: fmtAmount(stats.totalCredit),
          hint: 'Total credits in period',
        },
        {
          label: 'Vouchers',
          value: stats.voucherCount.toLocaleString(),
          hint: 'Entries touching this account',
        },
      ];
  }
}
