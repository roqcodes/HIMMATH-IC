import type React from 'react';
import type { AsicKpiMetric } from '@/components/asic/AsicKpiStrip';
import { fmtLedgerAed, fmtLedgerInr } from '@/lib/icFunds/format';
import { ledgerAedNode, ledgerInrNode, signedLedgerAmountNode } from '@/lib/icFunds/formatDisplay';

export type LedgerFlowSnapshot = {
  opening: number;
  periodDebit: number;
  periodCredit: number;
  closing: number;
};

export function signedBalanceHint(n: number): string {
  if (Math.abs(n) < 0.005) return 'Nil';
  return n > 0 ? 'Debit · receivable' : 'Credit · payable';
}

export function fmtSignedLedgerAmount(fmt: (n: number) => string, n: number): string {
  if (Math.abs(n) < 0.005) return fmt(0);
  return `${n > 0 ? 'Dr' : 'Cr'} ${fmt(Math.abs(n))}`;
}

function fmtSignedLedgerValue(currency: 'AED' | 'INR', n: number): React.ReactNode {
  const fmtPlain = currency === 'INR' ? fmtLedgerInr : fmtLedgerAed;
  if (Math.abs(n) < 0.005) return signedLedgerAmountNode(currency, 0);
  return signedLedgerAmountNode(currency, n);
}

export function cumulativeFlowHint(flow: 'purchase' | 'sale', n: number): string {
  if (Math.abs(n) < 0.005) return 'Nil';
  return flow === 'purchase'
    ? n > 0
      ? 'Cumulative purchased'
      : 'Purchase reversals'
    : n > 0
      ? 'Cumulative sold'
      : 'Sale reversals';
}

/** Counterparty ledger account (Dr − Cr balance). */
export function buildLedgerAccountMetrics(params: {
  book: LedgerFlowSnapshot & { accountId?: string | null };
  rangeLabel: string;
  currency: 'AED' | 'INR';
}): AsicKpiMetric[] {
  const { book, rangeLabel, currency } = params;
  const hasAccount = book.accountId != null && book.accountId !== '';
  const dash = '—';
  const net = book.periodDebit - book.periodCredit;
  const fmtPlain = currency === 'INR' ? fmtLedgerInr : fmtLedgerAed;
  const amountNode = currency === 'INR' ? ledgerInrNode : ledgerAedNode;

  return [
    {
      label: `${currency} opening`,
      value: hasAccount ? fmtSignedLedgerValue(currency, book.opening) : dash,
      valueTitle: hasAccount ? fmtSignedLedgerAmount(fmtPlain, book.opening) : undefined,
      hint: hasAccount ? signedBalanceHint(book.opening) : `No ${currency} account yet`,
    },
    {
      label: `${currency} period Dr`,
      value: hasAccount ? amountNode(book.periodDebit) : dash,
      valueTitle: hasAccount ? fmtPlain(book.periodDebit) : undefined,
      hint: `${rangeLabel} · they owe you`,
      tone: book.periodDebit > 0 ? 'emerald' : 'slate',
    },
    {
      label: `${currency} period Cr`,
      value: hasAccount ? amountNode(book.periodCredit) : dash,
      valueTitle: hasAccount ? fmtPlain(book.periodCredit) : undefined,
      hint: `${rangeLabel} · paid / credits`,
      tone: book.periodCredit > 0 ? 'amber' : 'slate',
    },
    {
      label: `${currency} closing`,
      value: hasAccount ? fmtSignedLedgerValue(currency, book.closing) : dash,
      valueTitle: hasAccount ? fmtSignedLedgerAmount(fmtPlain, book.closing) : undefined,
      hint: hasAccount
        ? `${signedBalanceHint(book.closing)} · net ${fmtSignedLedgerAmount(fmtPlain, net)}`
        : `No ${currency} account yet`,
      tone: !hasAccount
        ? 'slate'
        : book.closing > 0.005
          ? 'emerald'
          : book.closing < -0.005
            ? 'red'
            : 'slate',
    },
  ];
}

/** Deal flow totals (purchases = Dr in period; sales = Cr in period). */
export function buildDealFlowBookMetrics(params: {
  book: LedgerFlowSnapshot;
  rangeLabel: string;
  currency: 'AED' | 'INR';
  flow: 'purchase' | 'sale' | 'combined';
  countHint?: string;
}): AsicKpiMetric[] {
  const { book, rangeLabel, currency, flow, countHint } = params;
  const dash = '—';
  const rangeWithCount = countHint ? `${rangeLabel} · ${countHint}` : rangeLabel;
  const fmtPlain = currency === 'INR' ? fmtLedgerInr : fmtLedgerAed;
  const amountNode = currency === 'INR' ? ledgerInrNode : ledgerAedNode;

  if (flow === 'combined') {
    const net = book.periodDebit - book.periodCredit;
    const inrStock = currency === 'INR';
    return [
      {
        label: `${currency} opening`,
        value: fmtSignedLedgerValue(currency, book.opening),
        valueTitle: fmtSignedLedgerAmount(fmtPlain, book.opening),
        hint: inrStock
          ? `Unsold metal at cost before period${countHint ? ` · ${countHint}` : ''}`
          : `Net purchased before period${countHint ? ` · ${countHint}` : ''}`,
      },
      {
        label: `${currency} period Dr`,
        value: book.periodDebit > 0.005 ? amountNode(book.periodDebit) : dash,
        valueTitle: book.periodDebit > 0.005 ? fmtPlain(book.periodDebit) : undefined,
        hint: `Purchases · ${rangeWithCount}`,
      },
      {
        label: `${currency} period Cr`,
        value: book.periodCredit > 0.005 ? amountNode(book.periodCredit) : dash,
        valueTitle: book.periodCredit > 0.005 ? fmtPlain(book.periodCredit) : undefined,
        hint: `Sales · ${rangeWithCount}`,
        tone: book.periodCredit > 0.005 ? 'amber' : 'slate',
      },
      {
        label: `${currency} closing`,
        value: fmtSignedLedgerValue(currency, book.closing),
        valueTitle: fmtSignedLedgerAmount(fmtPlain, book.closing),
        hint: inrStock
          ? `Unsold metal at cost after period`
          : `Net after period · movement ${fmtSignedLedgerAmount(fmtPlain, net)}`,
        tone: book.closing > 0.005 ? 'emerald' : book.closing < -0.005 ? 'red' : 'slate',
      },
    ];
  }

  const periodDr = flow === 'purchase' ? book.periodDebit : 0;
  const periodCr = flow === 'sale' ? book.periodCredit : 0;
  const net = periodDr - periodCr;

  return [
    {
      label: `${currency} opening`,
      value: fmtSignedLedgerValue(currency, book.opening),
      valueTitle: fmtSignedLedgerAmount(fmtPlain, book.opening),
      hint: cumulativeFlowHint(flow, book.opening),
    },
    {
      label: `${currency} period Dr`,
      value: periodDr > 0.005 ? amountNode(periodDr) : dash,
      valueTitle: periodDr > 0.005 ? fmtPlain(periodDr) : undefined,
      hint: flow === 'purchase' ? rangeWithCount : '—',
    },
    {
      label: `${currency} period Cr`,
      value: periodCr > 0.005 ? amountNode(periodCr) : dash,
      valueTitle: periodCr > 0.005 ? fmtPlain(periodCr) : undefined,
      hint: flow === 'sale' ? rangeWithCount : '—',
      tone: periodCr > 0.005 ? 'amber' : 'slate',
    },
    {
      label: `${currency} closing`,
      value: fmtSignedLedgerValue(currency, book.closing),
      valueTitle: fmtSignedLedgerAmount(fmtPlain, book.closing),
      hint: `${cumulativeFlowHint(flow, book.closing)} · net ${fmtSignedLedgerAmount(fmtPlain, net)}`,
      tone: book.closing > 0.005 ? 'emerald' : book.closing < -0.005 ? 'red' : 'slate',
    },
  ];
}
