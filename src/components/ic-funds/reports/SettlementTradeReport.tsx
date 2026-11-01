'use client';

import { fmtICAmount, fmtICDate, fmtLedgerAed } from '@/lib/icFunds/format';
import {
  settlementTradeReportSubtitle,
  settlementTradeReportTitle,
  type ICSettlementTradeLine,
  type ICSettlementTradeReport,
} from '@/lib/icFunds/settlementTradeReport';
import { icfTableWrap, icfTd, icfTh, icfThAlign, icfTheadRow } from '@/components/ic-funds/ui';
import { ReportAmountCell, ReportCaption } from './reportShared';

function fmtInr(n: number | undefined): string {
  if (n == null || !Number.isFinite(n) || n === 0) return '—';
  return `${fmtICAmount(n)} INR`;
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
  isMetal,
  emptyMessage,
}: {
  title: string;
  rows: ICSettlementTradeLine[];
  isMetal: boolean;
  emptyMessage: string;
}) {
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
              <th className={icfTh}>Warehouse</th>
              {isMetal ? (
                <>
                  <th className={icfThAlign('right')}>Fine wt (g)</th>
                  <th className={icfThAlign('right')}>INR / g</th>
                  <th className={icfThAlign('right')}>AED / g</th>
                  <th className={icfThAlign('right')}>INR value</th>
                </>
              ) : null}
              <th className={icfThAlign('right')}>Units</th>
              <th className={icfThAlign('right')}>Rate (AED)</th>
              <th className={icfThAlign('right')}>Amount (AED)</th>
              {isMetal ? <th className={icfThAlign('right')}>P&L</th> : null}
              <th className={icfTh}>Settlement</th>
              <th className={icfTh}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={isMetal ? 13 : 9} className={`${icfTd} py-6 text-center text-slate-500`}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map(row => {
                const status =
                  row.txnKind === 'purchase'
                    ? row.paymentStatus || row.paymentMethod || '—'
                    : row.orderStatus || row.paymentStatus || '—';
                return (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className={`${icfTd} tabular-nums`}>{fmtICDate(row.date)}</td>
                    <td className={`${icfTd} font-mono text-xs text-slate-600`}>{row.reference}</td>
                    <td className={`${icfTd} max-w-[11rem] truncate font-medium`}>{partyCell(row)}</td>
                    <td className={`${icfTd} max-w-[10rem] truncate text-slate-600`}>{warehouseCell(row)}</td>
                    {isMetal ? (
                      <>
                        <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtWeightG(row.metalWeightG)}</td>
                        <td className={`${icfTd} text-right font-mono tabular-nums text-slate-600`}>
                          {row.metalRateInrPerG ? fmtInr(row.metalRateInrPerG) : '—'}
                        </td>
                        <td className={`${icfTd} text-right font-mono tabular-nums text-slate-600`}>
                          {row.metalRateAedPerG ? fmtLedgerAed(row.metalRateAedPerG) : '—'}
                        </td>
                        <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtInr(row.inrTotal)}</td>
                      </>
                    ) : null}
                    <td className={`${icfTd} text-right font-mono tabular-nums`}>
                      {row.units.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </td>
                    <td className={`${icfTd} text-right font-mono tabular-nums text-slate-600`}>
                      {row.unitRateAed > 0 ? fmtLedgerAed(row.unitRateAed) : '—'}
                    </td>
                    <ReportAmountCell n={row.aedTotal} />
                    {isMetal ? (
                      <td className={`${icfTd} text-right font-mono tabular-nums`}>
                        {row.bookedProfit != null && row.bookedCurrency
                          ? `${row.bookedProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${row.bookedCurrency}`
                          : '—'}
                      </td>
                    ) : null}
                    <td className={`${icfTd} text-slate-600`}>{row.settlementLabel}</td>
                    <td className={`${icfTd} max-w-[8rem] truncate text-slate-500`}>{status}</td>
                  </tr>
                );
              })
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-medium dark:bg-[var(--theme-surface-elevated)]">
                <td className={icfTd} colSpan={4}>
                  Subtotal
                </td>
                {isMetal ? (
                  <>
                    <td className={`${icfTd} text-right font-mono tabular-nums`}>
                      {fmtWeightG(
                        rows.reduce((s, r) => s + (r.metalWeightG ?? 0), 0),
                      )}
                    </td>
                    <td className={icfTd} colSpan={2} />
                    <td className={`${icfTd} text-right font-mono tabular-nums`}>
                      {fmtInr(rows.reduce((s, r) => s + (r.inrTotal ?? 0), 0))}
                    </td>
                  </>
                ) : null}
                <td className={`${icfTd} text-right font-mono tabular-nums`}>
                  {rows.reduce((s, r) => s + r.units, 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </td>
                <td className={icfTd} />
                <ReportAmountCell n={rows.reduce((s, r) => s + r.aedTotal, 0)} />
                {isMetal ? <td className={icfTd} /> : null}
                <td className={icfTd} colSpan={2} />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}

export default function SettlementTradeReport({
  report,
  periodLabel,
}: {
  report: ICSettlementTradeReport;
  periodLabel: string;
}) {
  const isMetal = report.settlementMode === 'metal';
  const { summary } = report;

  return (
    <div>
      <ReportCaption>
        {periodLabel} · {settlementTradeReportTitle(report.settlementMode)} ·{' '}
        {settlementTradeReportSubtitle(report.settlementMode)}
      </ReportCaption>

      <div className="grid gap-0 border-b border-slate-200 sm:grid-cols-2 lg:grid-cols-4 dark:border-[var(--theme-border)]">
        <div className="border-b border-slate-100 px-2.5 py-2 sm:border-b-0 sm:border-r dark:border-[var(--theme-border)]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Purchases</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-[var(--theme-text)]">
            {summary.purchaseCount} · {summary.purchaseUnits.toLocaleString(undefined, { maximumFractionDigits: 2 })} u
          </p>
          <p className="text-xs text-slate-500">{fmtLedgerAed(summary.purchaseAed)}</p>
        </div>
        <div className="border-b border-slate-100 px-2.5 py-2 sm:border-b-0 lg:border-r dark:border-[var(--theme-border)]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Sales</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-[var(--theme-text)]">
            {summary.saleCount} · {summary.saleUnits.toLocaleString(undefined, { maximumFractionDigits: 2 })} u
          </p>
          <p className="text-xs text-slate-500">{fmtLedgerAed(summary.saleAed)}</p>
        </div>
        {isMetal ? (
          <>
            <div className="border-b border-slate-100 px-2.5 py-2 sm:border-b-0 sm:border-r dark:border-[var(--theme-border)]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Metal purchased</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">{fmtWeightG(summary.metalWeightPurchasedG)}</p>
              <p className="text-xs text-slate-500">{fmtInr(summary.purchaseInr)}</p>
            </div>
            <div className="px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Metal sold</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">{fmtWeightG(summary.metalWeightSoldG)}</p>
              <p className="text-xs text-slate-500">{fmtInr(summary.saleInr)}</p>
            </div>
            <div className="border-t border-slate-100 px-2.5 py-2 sm:col-span-2 lg:col-span-4 dark:border-[var(--theme-border)]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Note</p>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-[var(--theme-text-secondary)]">
                INR pay: P&amp;L = sale INR − lot purchase INR (units return to the warehouse). AED pay: P&amp;L =
                sale AED − lot purchase AED (customer billed in AED).
              </p>
              <p className="mt-1 text-xs font-medium tabular-nums text-slate-700">
                Booked P&amp;L · {fmtInr(summary.bookedInrProfit)} · {fmtLedgerAed(summary.bookedAedProfit)}
              </p>
            </div>
          </>
        ) : (
          <div className="col-span-2 px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Net fund movement (AED)</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">
              {fmtLedgerAed(summary.saleAed - summary.purchaseAed)}
            </p>
            <p className="text-xs text-slate-500">
              Cash settlement only — AED in minus out in period, not gross profit
            </p>
          </div>
        )}
      </div>

      <TradeTable
        title="Purchases (buy register)"
        rows={report.purchases}
        isMetal={isMetal}
        emptyMessage="No purchases in this period for the selected settlement mode."
      />
      <TradeTable
        title="Sales (sell register)"
        rows={report.sales}
        isMetal={isMetal}
        emptyMessage="No sales in this period for the selected settlement mode."
      />
    </div>
  );
}
