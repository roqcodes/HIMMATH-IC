'use client';

import React from 'react';
import { fmtICDate, FmtLedgerAed, FmtLedgerAmount } from '@/lib/icFunds/format';
import type { ICWarehousePLLine, ICWarehousePLReport } from '@/lib/icFunds/warehouseProfit';
import { icfTableWrap, icfTd, icfTh, icfThAlign, icfTheadRow } from '@/components/ic-funds/ui';
import { ReportAmountCell, ReportSegmentTabs } from './reportShared';

function AmountCell({
  n,
  danger,
  currency = 'AED',
}: {
  n: number;
  danger?: boolean;
  currency?: 'AED' | 'INR';
}) {
  return (
    <td className={`${icfTd} text-right font-mono tabular-nums ${danger || n < 0 ? 'text-red-600' : ''}`}>
      {n === 0 ? '—' : <FmtLedgerAmount amount={n} book={currency} />}
    </td>
  );
}

function fmtUnits(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function fmtGrams(n: number): string {
  if (!n) return '—';
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 4 })} g`;
}

/** INR columns on Metal tab: same economics for INR-book and agent-AED deals. */
function metalLineRevenueInr(l: ICWarehousePLLine): number {
  if (l.lineKind === 'metal_purchase') return 0;
  if (l.metalDisplayRevenueInr != null) return l.metalDisplayRevenueInr;
  return l.bookedCurrency === 'INR' ? l.revenue : 0;
}

function metalLineCostInr(l: ICWarehousePLLine): number {
  if (l.metalDisplayCostInr != null) return l.metalDisplayCostInr;
  return l.bookedCurrency === 'INR' ? l.cogs : 0;
}

function metalLineProfitInr(l: ICWarehousePLLine): number {
  if (l.lineKind === 'metal_purchase') return 0;
  if (l.metalDisplayProfitInr != null) return l.metalDisplayProfitInr;
  return l.bookedCurrency === 'INR' ? l.grossProfit : 0;
}

export default function WarehouseStatementReport({
  report,
  warehouses,
  lines,
  book,
  onBookChange,
}: {
  report: ICWarehousePLReport;
  warehouses: ICWarehousePLReport['warehouses'];
  lines: ICWarehousePLReport['lines'];
  book: 'ic' | 'metal';
  onBookChange: (book: 'ic' | 'metal') => void;
}) {
  const totals = report.totals;
  const icLines = lines.filter(l => l.settlementMode !== 'metal');
  const metalLines = lines.filter(l => l.settlementMode === 'metal');

  const sum = (rows: typeof lines, pick: (l: (typeof lines)[number]) => number) =>
    rows.reduce((s, l) => s + pick(l), 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-2.5 py-2 dark:border-[var(--theme-border)]">
        <ReportSegmentTabs
          label="Book"
          value={book}
          onChange={onBookChange}
          options={[
            { id: 'ic', label: 'IC (AED)' },
            { id: 'metal', label: 'Metal (INR)' },
          ]}
        />
      </div>

      {book === 'ic' ? (
        <>
          <div className={icfTableWrap}>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className={icfTheadRow}>
                  <th className={icfTh}>Warehouse</th>
                  <th className={icfThAlign('right')}>Open</th>
                  <th className={icfThAlign('right')}>In</th>
                  <th className={icfThAlign('right')}>Out</th>
                  <th className={icfThAlign('right')}>Close</th>
                  <th className={icfThAlign('right')}>IC profit (AED)</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.length === 0 ? (
                  <tr>
                    <td className={`${icfTd} py-6 text-center text-slate-500`} colSpan={6}>
                      No warehouse activity in this period. Try widening the date range or clearing filters.
                    </td>
                  </tr>
                ) : (
                  warehouses.map(row => (
                    <tr key={row.warehouseId} className="border-b border-slate-100">
                      <td className={`${icfTd} font-medium`}>{row.warehouseName}</td>
                      <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtUnits(row.openingUnits)}</td>
                      <td className={`${icfTd} text-right font-mono tabular-nums text-emerald-700`}>
                        {row.unitsIn > 0 ? fmtUnits(row.unitsIn) : '—'}
                      </td>
                      <td className={`${icfTd} text-right font-mono tabular-nums text-red-600`}>
                        {row.unitsOut > 0 ? fmtUnits(row.unitsOut) : '—'}
                      </td>
                      <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtUnits(row.closingUnits)}</td>
                      <AmountCell n={row.grossProfit} danger={row.grossProfit < 0} />
                    </tr>
                  ))
                )}
              </tbody>
              {warehouses.length > 0 ? (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 font-medium">
                    <td className={icfTd} colSpan={5}>
                      Total
                    </td>
                    <ReportAmountCell n={totals.grossProfit} danger={totals.grossProfit < 0} />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>

          <p className="border-b border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-500 dark:text-[var(--theme-text-muted)]">
            IC cash — detail
          </p>
          <div className={icfTableWrap}>
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className={icfTheadRow}>
                  <th className={icfTh}>Date</th>
                  <th className={icfTh}>Warehouse</th>
                  <th className={icfTh}>Customer</th>
                  <th className={icfThAlign('right')}>Units</th>
                  <th className={icfThAlign('right')}>Sales (AED)</th>
                  <th className={icfThAlign('right')}>Cost (AED)</th>
                  <th className={icfThAlign('right')}>Profit (AED)</th>
                </tr>
              </thead>
              <tbody>
                {icLines.length === 0 ? (
                  <tr>
                    <td className={`${icfTd} py-6 text-center text-slate-500`} colSpan={7}>
                      No IC cash sales in this view.
                    </td>
                  </tr>
                ) : (
                  icLines.map(line => (
                    <tr key={line.saleId} className="border-b border-slate-100">
                      <td className={icfTd}>{fmtICDate(line.saleDate)}</td>
                      <td className={icfTd}>{line.warehouseName}</td>
                      <td className={`${icfTd} max-w-[10rem] truncate`}>{line.customerName}</td>
                      <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtUnits(line.units)}</td>
                      <AmountCell n={line.revenue} />
                      <AmountCell n={line.cogs} />
                      <td className={`${icfTd} text-right font-mono tabular-nums ${line.grossProfit < 0 ? 'text-red-600' : ''}`}>
                        <FmtLedgerAed amount={line.grossProfit} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {icLines.length > 0 ? (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 font-medium">
                    <td className={icfTd} colSpan={4}>
                      Total (AED)
                    </td>
                    <ReportAmountCell n={totals.revenue} />
                    <ReportAmountCell n={totals.cogs} />
                    <ReportAmountCell n={totals.grossProfit} danger={totals.grossProfit < 0} />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </>
      ) : (
        <>
          <div className={icfTableWrap}>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className={icfTheadRow}>
                  <th className={icfTh}>Warehouse</th>
                  <th className={icfThAlign('right')}>Open g</th>
                  <th className={icfThAlign('right')}>In g</th>
                  <th className={icfThAlign('right')}>Out g</th>
                  <th className={icfThAlign('right')}>Close g</th>
                  <th className={icfThAlign('right')}>Metal P&amp;L (INR)</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.length === 0 ? (
                  <tr>
                    <td className={`${icfTd} py-6 text-center text-slate-500`} colSpan={6}>
                      No warehouse activity in this period.
                    </td>
                  </tr>
                ) : (
                  warehouses.map(row => (
                    <tr key={row.warehouseId} className="border-b border-slate-100">
                      <td className={`${icfTd} font-medium`}>{row.warehouseName}</td>
                      <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtGrams(row.openingMetalG)}</td>
                      <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtGrams(row.metalInG)}</td>
                      <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtGrams(row.metalOutG)}</td>
                      <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtGrams(row.closingMetalG)}</td>
                      <AmountCell n={row.metalProfitInr} danger={row.metalProfitInr < 0} currency="INR" />
                    </tr>
                  ))
                )}
              </tbody>
              {warehouses.length > 0 ? (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 font-medium">
                    <td className={icfTd} colSpan={5}>
                      Total (INR)
                    </td>
                    <ReportAmountCell n={totals.metalProfitInr} currency="INR" danger={totals.metalProfitInr < 0} />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>

          <p className="border-b border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-500 dark:text-[var(--theme-text-muted)]">
            Metal (INR) — detail
          </p>
          <div className={icfTableWrap}>
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className={icfTheadRow}>
                  <th className={icfTh}>Date</th>
                  <th className={icfTh}>Warehouse</th>
                  <th className={icfTh}>Party</th>
                  <th className={icfTh}>Type</th>
                  <th className={icfThAlign('right')}>Grams</th>
                  <th className={icfThAlign('right')}>Sales (INR)</th>
                  <th className={icfThAlign('right')}>Cost (INR)</th>
                  <th className={icfThAlign('right')}>Profit (INR)</th>
                </tr>
              </thead>
              <tbody>
                {metalLines.length === 0 ? (
                  <tr>
                    <td className={`${icfTd} py-6 text-center text-slate-500`} colSpan={8}>
                      No metal purchases or sales in this view.
                    </td>
                  </tr>
                ) : (
                  metalLines.map(line => {
                    const isPurchase = line.lineKind === 'metal_purchase';
                    return (
                      <tr key={`${line.lineKind}-${line.saleId}`} className="border-b border-slate-100">
                        <td className={icfTd}>{fmtICDate(line.saleDate)}</td>
                        <td className={icfTd}>{line.warehouseName}</td>
                        <td className={`${icfTd} max-w-[10rem] truncate`}>{line.customerName}</td>
                        <td className={icfTd}>{isPurchase ? 'Purchase' : 'Sale'}</td>
                        <td className={`${icfTd} text-right font-mono tabular-nums`}>
                          {fmtGrams(line.metalWeightG ?? line.units)}
                        </td>
                        <AmountCell n={metalLineRevenueInr(line)} currency="INR" />
                        <AmountCell n={metalLineCostInr(line)} currency="INR" />
                        <AmountCell
                          n={metalLineProfitInr(line)}
                          currency="INR"
                          danger={!isPurchase && metalLineProfitInr(line) < 0}
                        />
                      </tr>
                    );
                  })
                )}
              </tbody>
              {metalLines.length > 0 ? (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 font-medium">
                    <td className={icfTd} colSpan={5}>
                      Total
                    </td>
                    <ReportAmountCell n={sum(metalLines, metalLineRevenueInr)} currency="INR" />
                    <ReportAmountCell n={sum(metalLines, metalLineCostInr)} currency="INR" />
                    <ReportAmountCell
                      n={sum(metalLines, metalLineProfitInr)}
                      currency="INR"
                      danger={sum(metalLines, metalLineProfitInr) < 0}
                    />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </>
      )}
    </div>
  );
}
