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
import { splitTradeReceivablesPayables } from '@/lib/icFunds/voucherPartyAccounts';
import { trialBalanceColumnsBalanced } from '@/lib/icFunds/accountPeriodBalance';

import type { PlStatement } from '@/lib/icFunds/reportPresentation';

type ProfitLossSummary = {
  income: number;
  profit: number;
  expense: number;
  dExpense: number;
  net: number;
};

function computePlKpisFromStatement(statement: PlStatement): AsicKpiMetric[] {
  const metrics: AsicKpiMetric[] = [
    {
      label: 'IC sales',
      value: ledgerAedNode(statement.salesTotal),
      hint: 'Completed warehouse sales in period',
      tone: statement.salesTotal > 0 ? 'emerald' : 'slate',
    },
    {
      label: 'Direct costs',
      value: ledgerAedNode(statement.directCostsTotal),
      hint: 'Warehouse WAC cost on completed sales',
      tone: statement.directCostsTotal > 0 ? 'red' : 'slate',
    },
    {
      label: 'IC gross profit',
      value: ledgerAedNode(statement.grossResult),
      hint: 'IC sales less warehouse cost',
      tone: statement.grossResult >= 0 ? 'emerald' : 'red',
    },
    {
      label: 'Net result',
      value: ledgerAedNode(statement.netForPeriod),
      hint: 'Total IC profit across selected warehouses',
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
  const { receivables: receivableRows, payables: payableRows } = splitTradeReceivablesPayables(accounts);
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
        hint: `${receivableRows.length} parties owe us`,
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
  book: 'AED' | 'INR' = 'AED',
): AsicKpiMetric[] {
  const labels = VOUCHER_TOTAL_LABELS[voucherType];
  const amountNode = book === 'INR' ? ledgerInrNode : ledgerAedNode;
  const fmtPlain = book === 'INR' ? fmtLedgerInr : fmtLedgerAed;
  const pendingMetric: AsicKpiMetric =
    stats.pending > 0
      ? {
          label: 'Awaiting approval',
          value: amountNode(stats.pendingTotal),
          hint: `${stats.pending} pending ${stats.pending === 1 ? 'entry' : 'entries'}`,
          tone: 'amber',
        }
      : {
          label: 'Largest entry',
          value: stats.largest > 0 ? amountNode(stats.largest) : '—',
          valueTitle: stats.largest > 0 ? fmtPlain(stats.largest) : undefined,
          hint: 'Biggest posted amount',
        };

  return [
    {
      label: labels.total,
      value: amountNode(stats.total),
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

function rollupFromRangeStats(stats: ICFundVoucherRangeStats) {
  return {
    posted: stats.posted,
    postedTotal: stats.total,
    pending: stats.pending,
    pendingTotal: stats.pendingTotal,
    voided: stats.voided,
    largest: stats.largest,
    activeCount: stats.entries,
  };
}

export function computeBooksKpis(input: {
  reportView: ICFundsReportId;
  profitLoss?: ProfitLossSummary;
  plStatement?: PlStatement;
  balanceSheet?: BalanceSheetSummary;
  trialBalance?: ICFundTrialBalanceLine[];
  vouchers?: ICFundVoucher[];
  voucherRangeStats?: ICFundVoucherRangeStats;
  cashBank?: ICFundAccount[];
  receivables?: ICFundAccount[];
  payables?: ICFundAccount[];
  warehousePl?: ICWarehousePLReport | null;
  metalProfitInr?: number;
  metalSoldG?: number;
  settlementTradeReport?: ICSettlementTradeReport | null;
  statement?: {
    opening: number;
    closing: number;
    currency?: 'AED' | 'INR';
    lines: Array<{ debit: number; credit: number; status?: string }>;
  } | null;
  ledgerBook?: 'AED' | 'INR';
}): AsicKpiMetric[] {
  const {
    reportView,
    profitLoss,
    plStatement,
    balanceSheet,
    trialBalance = [],
    vouchers = [],
    voucherRangeStats,
    cashBank = [],
    receivables = [],
    payables = [],
    warehousePl,
    metalProfitInr,
    metalSoldG,
    settlementTradeReport,
    statement,
    ledgerBook = 'AED',
  } = input;

  if (reportView === 'profit-loss' && plStatement) {
    const metrics = computePlKpisFromStatement(plStatement);
    const metalInr = metalProfitInr ?? warehousePl?.totals.metalProfitInr;
    if (metalInr != null && (Math.abs(metalInr) > 0.005 || (metalSoldG ?? warehousePl?.totals.metalSoldG ?? 0) > 0)) {
      metrics.push({
        label: 'Metal P&L (INR)',
        value: ledgerInrNode(metalInr),
        hint: 'Commodity book · not included in AED net',
        tone: metalInr >= 0 ? 'emerald' : 'red',
      });
    }
    return metrics;
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
    const inrBook = ledgerBook === 'INR';
    const moneyNode = inrBook ? ledgerInrNode : ledgerAedNode;
    const fmtMoney = inrBook ? fmtLedgerInr : fmtLedgerAed;
    const debit = trialBalance.reduce((sum, line) => sum + (line.closingDebit ?? line.debit), 0);
    const credit = trialBalance.reduce((sum, line) => sum + (line.closingCredit ?? line.credit), 0);
    const pendingDr = trialBalance.reduce((sum, line) => sum + (line.pendingDebit ?? 0), 0);
    const pendingCr = trialBalance.reduce((sum, line) => sum + (line.pendingCredit ?? 0), 0);
    const balanced = trialBalanceColumnsBalanced(debit, credit);
    const diff = Math.abs(debit - credit);

    return [
      {
        label: 'Total debits',
        value: moneyNode(debit),
        hint: `${trialBalance.length} accounts with balance`,
      },
      {
        label: 'Total credits',
        value: moneyNode(credit),
        hint: 'Posted trial balance',
      },
      {
        label: 'Difference',
        value: balanced ? '—' : moneyNode(diff),
        valueTitle: balanced ? undefined : fmtMoney(diff),
        hint: balanced ? 'Debits equal credits' : 'Out of balance',
        tone: balanced ? 'emerald' : 'red',
      },
      {
        label: 'Pending',
        value: moneyNode(pendingDr + pendingCr),
        hint: `Dr ${fmtMoney(pendingDr)} · Cr ${fmtMoney(pendingCr)}`,
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
    const money = ledgerBook === 'INR' ? ledgerInrNode : ledgerAedNode;

    return [
      {
        label: 'Receivables',
        value: money(ar),
        hint: `${receivables.length} trade parties owe us (${ledgerBook})`,
      },
      {
        label: 'Payables',
        value: money(ap),
        hint: `${payables.length} balances we owe (${ledgerBook})`,
        tone: ap > 0 ? 'amber' : 'slate',
      },
      {
        label: 'Net position',
        value: money(ar - ap),
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

  if ((reportView === 'fund-trades' || reportView === 'metal-trades') && settlementTradeReport) {
    const s = settlementTradeReport.summary;
    const isMetal = settlementTradeReport.settlementMode === 'metal';
    if (isMetal) {
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
          label: 'Agent AED',
          value: ledgerAedNode(s.purchaseAed + s.saleAed),
          hint: `In ${fmtLedgerAed(s.purchaseAed)} · out ${fmtLedgerAed(s.saleAed)}`,
          tone: 'amber',
        },
        {
          label: 'Metal P&L (INR)',
          ...formatMetalPlKpi({
            metalProfitAed: s.bookedAedProfit,
            metalProfitInr: s.bookedInrProfit,
            rangeLabel: `${s.metalWeightSoldG.toLocaleString(undefined, { maximumFractionDigits: 2 })} g sold`,
          }),
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

  if (reportView === 'warehouse-pl' && warehousePl) {
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
        label: 'Metal P&L (INR)',
        ...formatMetalPlKpi({
          metalProfitAed: t.metalProfitAed,
          metalProfitInr: t.metalProfitInr,
          rangeLabel: '',
        }),
      },
      {
        label: 'Warehouses',
        value: warehousePl.warehouses.length.toLocaleString(),
        hint: 'With activity in period',
        tone: 'slate',
      },
    ];
  }

  if (reportView === 'statement' && statement) {
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
    const rollup = vouchers.length > 0 ? rollupVouchers(vouchers) : voucherRangeStats ? rollupFromRangeStats(voucherRangeStats) : rollupVouchers(vouchers);
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
            ? ledgerAedNode(
                vouchers.length > 0
                  ? Math.max(...vouchers.filter(v => v.status === 'active').map(v => v.amount), 0)
                  : voucherRangeStats?.largest ?? 0,
              )
            : '—',
        valueTitle:
          rollup.posted > 0
            ? fmtLedgerAed(
                vouchers.length > 0
                  ? Math.max(...vouchers.filter(v => v.status === 'active').map(v => v.amount), 0)
                  : voucherRangeStats?.largest ?? 0,
              )
            : undefined,
        hint: 'Biggest posted voucher',
      },
    ];
  }

  const rollup =
    vouchers.length > 0
      ? {
          ...rollupVouchers(vouchers),
          largest: Math.max(...vouchers.filter(v => v.status === 'active').map(v => v.amount), 0),
        }
      : voucherRangeStats
        ? rollupFromRangeStats(voucherRangeStats)
        : { ...rollupVouchers(vouchers), largest: 0 };

  const money = ledgerBook === 'INR' ? ledgerInrNode : ledgerAedNode;
  const fmtMoney = ledgerBook === 'INR' ? fmtLedgerInr : fmtLedgerAed;

  return [
    {
      label: 'Posted value',
      value: money(rollup.postedTotal),
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
      value: rollup.pending > 0 ? money(rollup.pendingTotal) : '—',
      valueTitle: rollup.pending > 0 ? fmtMoney(rollup.pendingTotal) : undefined,
      hint: rollup.pending > 0 ? `${rollup.pending} awaiting approval` : 'Nothing pending',
      tone: rollup.pending > 0 ? 'amber' : 'slate',
    },
    {
      label: 'Largest',
      value: rollup.posted > 0 ? money(rollup.largest) : '—',
      valueTitle: rollup.posted > 0 ? fmtMoney(rollup.largest) : undefined,
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
    case 'capital':
      return [
        {
          label: 'Capital balance',
          value: fmtAmount(balance),
          hint: 'Investor equity (credit)',
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
