'use client';

import React from 'react';
import { fmtICDate, FmtLedgerAed, FmtLedgerInr } from '@/lib/icFunds/format';
import {
  settlementTradeReportSubtitle,
  settlementTradeReportTitle,
  tradeLineBookAed,
  tradeLineBookInr,
  type ICSettlementTradeLine,
  type ICSettlementTradeReport,
} from '@/lib/icFunds/settlementTradeReport';
import { icfTableWrap, icfTd, icfTh, icfThAlign, icfTheadRow } from '@/components/ic-funds/ui';
import { ReportAmountCell, ReportCaption, ReportSegmentTabs } from './reportShared';

export type SettlementTradeReportVariant = 'fund' | 'metal-inr' | 'metal-agent';

function fmtInr(n: number | undefined): React.ReactNode {
  if (n == null || !Number.isFinite(n) || n === 0) return '—';
  return <FmtLedgerInr amount={n} />;
}

function fmtWeightG(n: number | undefined): string {
  if (n == null || !Number.isFinite(n) || n === 0) return '—';
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 4 })} g`;
}

function partyCell(line: ICSettlementTradeLine) {
  if (line.counterpartyCode) {
    return `${line.counterpartyCode} · ${line.counterparty}`;
  }
  return line.counterparty;
}

function warehouseCell(line: ICSettlementTradeLine) {
  if (!line.warehouseName) return '—';
  if (line.warehouseCode) return `${line.warehouseCode} · ${line.warehouseName}`;
  return line.warehouseName;
}

function TradeTable({
  title,
  rows,
  variant,
  emptyMessage,
}: {
  title: string;
  rows: ICSettlementTradeLine[];
  variant: SettlementTradeReportVariant;
  emptyMessage: string;
}) {
  const isFund = variant === 'fund';
  const isMetalInr = variant === 'metal-inr';
  const isAgent = variant === 'metal-agent';

  const colCount = isFund ? 9 : isMetalInr ? 10 : 9;

  return (
    <div className="border-b border-slate-200 last:border-b-0 dark:border-[var(--theme-border)]">
      <p className="border-b border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-[var(--theme-surface-elevated)] dark:text-[var(--theme-text-secondary)]">
        {title}
        <span className="ml-2 font-normal normal-case tracking-normal text-slate-500">
          ({rows.length} {rows.length === 1 ? 'entry' : 'entries'})
        </span>
      </p>
      <div className={icfTableWrap}>
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className={icfTheadRow}>
              <th className={icfTh}>Date</th>
              <th className={icfTh}>Ref #</th>
              <th className={icfTh}>Counterparty</th>
              {isAgent ? <th className={icfTh}>AED agent</th> : null}
              <th className={icfTh}>Warehouse</th>
              {isFund ? null : <th className={icfThAlign('right')}>Fine wt (g)</th>}
              {isMetalInr ? (
                <>
                  <th className={icfThAlign('right')}>INR / g</th>
                  <th className={icfThAlign('right')}>INR value</th>
                  <th className={icfThAlign('right')}>P&amp;L (INR)</th>
                </>
              ) : null}
              {isFund ? (
                <>
                  <th className={icfThAlign('right')}>Units</th>
                  <th className={icfThAlign('right')}>Rate (AED)</th>
                  <th className={icfThAlign('right')}>Amount (AED)</th>
                </>
              ) : null}
              {isAgent ? <th className={icfThAlign('right')}>Amount (AED)</th> : null}
              <th className={icfTh}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className={`${icfTd} py-6 text-center text-slate-500`}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map(row => {
                const status =
                  row.txnKind === 'purchase'
                    ? row.paymentStatus || row.paymentMethod || '—'
                    : row.orderStatus || row.paymentStatus || '—';
                const aedAmount = tradeLineBookAed(row);
                return (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className={`${icfTd} tabular-nums`}>{fmtICDate(row.date)}</td>
                    <td className={`${icfTd} font-mono text-xs text-slate-600`}>{row.reference}</td>
                    <td className={`${icfTd} max-w-[11rem] truncate font-medium`}>{partyCell(row)}</td>
                    {isAgent ? (
                      <td className={`${icfTd} max-w-[10rem] truncate text-slate-600`}>
                        {row.aedAgentName ?? '—'}
                      </td>
                    ) : null}
                    <td className={`${icfTd} max-w-[10rem] truncate text-slate-600`}>{warehouseCell(row)}</td>
                    {isFund ? null : (
                      <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtWeightG(row.metalWeightG)}</td>
                    )}
                    {isMetalInr ? (
                      <>
                        <td className={`${icfTd} text-right font-mono tabular-nums text-slate-600`}>
                          {row.metalRateInrPerG ? fmtInr(row.metalRateInrPerG) : '—'}
                        </td>
                        <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtInr(row.inrTotal)}</td>
                        <td className={`${icfTd} text-right font-mono tabular-nums`}>
                          {row.bookedProfitInr != null ? (
                            <FmtLedgerInr amount={row.bookedProfitInr} />
                          ) : row.bookedCurrency === 'INR' && row.bookedProfit != null ? (
                            <FmtLedgerInr amount={row.bookedProfit} />
                          ) : (
                            '—'
                          )}
                        </td>
                      </>
                    ) : null}
                    {isFund ? (
                      <>
                        <td className={`${icfTd} text-right font-mono tabular-nums`}>
                          {row.units.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </td>
                        <td className={`${icfTd} text-right font-mono tabular-nums text-slate-600`}>
                          {aedAmount > 0 && row.unitRateAed > 0 ? <FmtLedgerAed amount={row.unitRateAed} /> : '—'}
                        </td>
                        <ReportAmountCell n={aedAmount} />
                      </>
                    ) : null}
                    {isAgent ? <ReportAmountCell n={aedAmount} /> : null}
                    <td className={`${icfTd} max-w-[8rem] truncate text-slate-500`}>{status}</td>
                  </tr>
                );
              })
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-medium dark:bg-[var(--theme-surface-elevated)]">
                <td className={icfTd} colSpan={isAgent ? 4 : 3}>
                  Subtotal
                </td>
                {isFund ? null : (
                  <td className={`${icfTd} text-right font-mono tabular-nums`}>
                    {fmtWeightG(rows.reduce((s, r) => s + (r.metalWeightG ?? 0), 0))}
                  </td>
                )}
                {isMetalInr ? (
                  <>
                    <td className={icfTd} />
                    <td className={`${icfTd} text-right font-mono tabular-nums`}>
                      {fmtInr(rows.reduce((s, r) => s + tradeLineBookInr(r), 0))}
                    </td>
                    <td className={`${icfTd} text-right font-mono tabular-nums`}>
                      <FmtLedgerInr
                        amount={rows.reduce(
                          (s, r) =>
                            s +
                            (r.bookedProfitInr ??
                              (r.bookedCurrency === 'INR' ? r.bookedProfit ?? 0 : 0)),
                          0,
                        )}
                      />
                    </td>
                  </>
                ) : null}
                {isFund ? (
                  <>
                    <td className={`${icfTd} text-right font-mono tabular-nums`}>
                      {rows.reduce((s, r) => s + r.units, 0).toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}
                    </td>
                    <td className={icfTd} />
                    <ReportAmountCell n={rows.reduce((s, r) => s + tradeLineBookAed(r), 0)} />
                  </>
                ) : null}
                {isAgent ? (
                  <ReportAmountCell n={rows.reduce((s, r) => s + tradeLineBookAed(r), 0)} />
                ) : null}
                <td className={icfTd} />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}

function variantCaption(variant: SettlementTradeReportVariant): string {
  if (variant === 'fund') {
    return settlementTradeReportSubtitle('cash');
  }
  if (variant === 'metal-inr') {
    return 'Cash metal only — grams and rupees. AED agent cash is on the other tab.';
  }
  return 'Cash with the AED agent — not metal profit.';
}

function variantTitle(variant: SettlementTradeReportVariant): string {
  if (variant === 'fund') return settlementTradeReportTitle('cash');
  if (variant === 'metal-inr') return 'Cash metal (INR)';
  return 'AED agent';
}

export default function SettlementTradeReport({
  report,
  periodLabel,
  variant,
  metalBook,
  onMetalBookChange,
}: {
  report: ICSettlementTradeReport;
  periodLabel: string;
  variant: SettlementTradeReportVariant;
  metalBook?: 'inr' | 'aed';
  onMetalBookChange?: (book: 'inr' | 'aed') => void;
}) {
  const { summary } = report;
  const isFund = variant === 'fund';
  const isMetalInr = variant === 'metal-inr';
  const showMetalTabs = !isFund && metalBook && onMetalBookChange;

  return (
    <div>
      {showMetalTabs ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-2.5 py-2 dark:border-[var(--theme-border)]">
          <ReportSegmentTabs
            label="Metal register book"
            value={metalBook}
            onChange={onMetalBookChange}
            options={[
              { id: 'inr', label: 'Cash metal (INR)' },
              { id: 'aed', label: 'AED agent' },
            ]}
          />
        </div>
      ) : null}
      <ReportCaption>
        {periodLabel} · {variantTitle(variant)} · {variantCaption(variant)}
      </ReportCaption>

      <div className="grid gap-0 border-b border-slate-200 sm:grid-cols-2 lg:grid-cols-4 dark:border-[var(--theme-border)]">
        {isFund ? (
          <>
            <div className="border-b border-slate-100 px-2.5 py-2 sm:border-b-0 sm:border-r dark:border-[var(--theme-border)]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Purchases</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-[var(--theme-text)]">
                {summary.purchaseCount} · {summary.purchaseUnits.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                u
              </p>
              <p className="text-xs text-slate-500">
                <FmtLedgerAed amount={summary.purchaseAed} />
              </p>
            </div>
            <div className="border-b border-slate-100 px-2.5 py-2 sm:border-b-0 lg:border-r dark:border-[var(--theme-border)]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Sales</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-[var(--theme-text)]">
                {summary.saleCount} · {summary.saleUnits.toLocaleString(undefined, { maximumFractionDigits: 2 })} u
              </p>
              <p className="text-xs text-slate-500">
                <FmtLedgerAed amount={summary.saleAed} />
              </p>
            </div>
            <div className="col-span-2 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Net fund movement (AED)</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">
                <FmtLedgerAed amount={summary.saleAed - summary.purchaseAed} />
              </p>
              <p className="text-xs text-slate-500">Cash settlement in period — not gross profit</p>
            </div>
          </>
        ) : isMetalInr ? (
          <>
            <div className="border-b border-slate-100 px-2.5 py-2 sm:border-b-0 sm:border-r dark:border-[var(--theme-border)]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Metal purchased</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">{fmtWeightG(summary.metalWeightPurchasedG)}</p>
              <p className="text-xs text-slate-500">{fmtInr(summary.purchaseInr)}</p>
            </div>
            <div className="border-b border-slate-100 px-2.5 py-2 sm:border-b-0 sm:border-r dark:border-[var(--theme-border)]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Metal sold</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">{fmtWeightG(summary.metalWeightSoldG)}</p>
              <p className="text-xs text-slate-500">{fmtInr(summary.saleInr)}</p>
            </div>
            <div className="px-2.5 py-2 sm:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Booked P&amp;L (INR)</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">
                <FmtLedgerInr amount={summary.bookedInrProfit} />
              </p>
              <p className="text-xs text-slate-500">Sale rupees minus purchase rupees</p>
            </div>
          </>
        ) : (
          <>
            <div className="border-b border-slate-100 px-2.5 py-2 sm:border-b-0 sm:border-r dark:border-[var(--theme-border)]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Purchases (AED)</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">
                <FmtLedgerAed amount={summary.purchaseAed} />
              </p>
              <p className="text-xs text-slate-500">{summary.purchaseCount} entries</p>
            </div>
            <div className="border-b border-slate-100 px-2.5 py-2 sm:border-b-0 sm:border-r dark:border-[var(--theme-border)]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Sales (AED)</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">
                <FmtLedgerAed amount={summary.saleAed} />
              </p>
              <p className="text-xs text-slate-500">{summary.saleCount} entries</p>
            </div>
            <div className="px-2.5 py-2 sm:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Net agent settlement</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">
                <FmtLedgerAed amount={summary.saleAed - summary.purchaseAed} />
              </p>
              <p className="text-xs text-slate-500">Settlement with AED agents — not INR metal profit</p>
            </div>
          </>
        )}
      </div>

      <TradeTable
        title="Purchases (buy register)"
        rows={report.purchases}
        variant={variant}
        emptyMessage="No purchases in this period."
      />
      <TradeTable
        title="Sales (sell register)"
        rows={report.sales}
        variant={variant}
        emptyMessage="No sales in this period."
      />
    </div>
  );
}
