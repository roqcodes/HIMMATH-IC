'use client';

import React from 'react';
import { fmtICDate, FmtLedgerAed, FmtLedgerAmount } from '@/lib/icFunds/format';
import type { ICWarehousePLReport } from '@/lib/icFunds/warehouseProfit';
import { icfTableWrap, icfTd, icfTh, icfThAlign, icfTheadRow } from '@/components/ic-funds/ui';
import { ReportAmountCell, ReportCaption, ReportSegmentTabs } from './reportShared';

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

export default function WarehouseStatementReport({
  report,
  warehouses,
  lines,
  periodLabel,
  book,
  onBookChange,
}: {
  report: ICWarehousePLReport;
  warehouses: ICWarehousePLReport['warehouses'];
  lines: ICWarehousePLReport['lines'];
  periodLabel: string;
  book: 'ic' | 'metal';
  onBookChange: (book: 'ic' | 'metal') => void;
}) {
  const totals = report.totals;
  const icLines = lines.filter(l => l.settlementMode !== 'metal');
  const metalLines = lines.filter(l => l.settlementMode === 'metal');
  const metalInrLines = metalLines.filter(l => l.bookedCurrency !== 'AED');
  const metalAedLines = metalLines.filter(l => l.bookedCurrency === 'AED');

  const sum = (rows: typeof lines, pick: (l: (typeof lines)[number]) => number) =>
    rows.reduce((s, l) => s + pick(l), 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-2.5 py-2 dark:border-[var(--theme-border)]">
        <ReportSegmentTabs
          label="Warehouse book"
          value={book}
          onChange={onBookChange}
          options={[
            { id: 'ic', label: 'IC cash (AED)' },
            { id: 'metal', label: 'Metal' },
          ]}
        />
      </div>

      {book === 'ic' ? (
        <>
          <ReportCaption>
            {periodLabel} · IC is units and dirhams. Metal grams are on the other tab.
          </ReportCaption>
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
                      Totals (IC cash, AED)
                    </td>
                    <ReportAmountCell n={totals.grossProfit} danger={totals.grossProfit < 0} />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>

          <p className="border-b border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-500">
            IC sales in this period
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
                      No completed IC cash sales in this view.
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
                      Totals (AED)
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
          <ReportCaption>
            {periodLabel} · Metal is grams. P&amp;L (INR) and agent P&amp;L (AED) are separate — do not add the two
            profit columns.
          </ReportCaption>
          <div className={icfTableWrap}>
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className={icfTheadRow}>
                  <th className={icfTh}>Warehouse</th>
                  <th className={icfThAlign('right')}>Open g</th>
                  <th className={icfThAlign('right')}>In g</th>
                  <th className={icfThAlign('right')}>Out g</th>
                  <th className={icfThAlign('right')}>Close g</th>
                  <th className={icfThAlign('right')}>P&amp;L (INR)</th>
                  <th className={icfThAlign('right')}>Agent P&amp;L (AED)</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.length === 0 ? (
                  <tr>
                    <td className={`${icfTd} py-6 text-center text-slate-500`} colSpan={7}>
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
                      <AmountCell n={row.metalProfitAed} danger={row.metalProfitAed < 0} />
                    </tr>
                  ))
                )}
              </tbody>
              {warehouses.length > 0 ? (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 font-medium">
                    <td className={icfTd} colSpan={5}>
                      Totals (do not add across)
                    </td>
                    <ReportAmountCell n={totals.metalProfitInr} currency="INR" danger={totals.metalProfitInr < 0} />
                    <ReportAmountCell n={totals.metalProfitAed} danger={totals.metalProfitAed < 0} />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>

          <p className="border-b border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-500">
            Metal sales in this period
          </p>
          <div className={icfTableWrap}>
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className={icfTheadRow}>
                  <th className={icfTh}>Date</th>
                  <th className={icfTh}>Warehouse</th>
                  <th className={icfTh}>Customer</th>
                  <th className={icfTh}>Book</th>
                  <th className={icfThAlign('right')}>Grams</th>
                  <th className={icfThAlign('right')}>Sales</th>
                  <th className={icfThAlign('right')}>Cost</th>
                  <th className={icfThAlign('right')}>Profit</th>
                </tr>
              </thead>
              <tbody>
                {metalLines.length === 0 ? (
                  <tr>
                    <td className={`${icfTd} py-6 text-center text-slate-500`} colSpan={8}>
                      No completed metal sales in this view.
                    </td>
                  </tr>
                ) : (
                  metalLines.map(line => {
                    const bookCur = line.bookedCurrency === 'AED' ? 'AED' : 'INR';
                    return (
                      <tr key={line.saleId} className="border-b border-slate-100">
                        <td className={icfTd}>{fmtICDate(line.saleDate)}</td>
                        <td className={icfTd}>{line.warehouseName}</td>
                        <td className={`${icfTd} max-w-[10rem] truncate`}>{line.customerName}</td>
                        <td className={icfTd}>{bookCur}</td>
                        <td className={`${icfTd} text-right font-mono tabular-nums`}>
                          {fmtGrams(line.metalWeightG ?? line.units)}
                        </td>
                        <AmountCell n={line.revenue} currency={bookCur} />
                        <AmountCell n={line.cogs} currency={bookCur} />
                        <td
                          className={`${icfTd} text-right font-mono tabular-nums ${line.grossProfit < 0 ? 'text-red-600' : ''}`}
                        >
                          <FmtLedgerAmount amount={line.grossProfit} book={bookCur} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {metalLines.length > 0 ? (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 font-medium">
                    <td className={icfTd} colSpan={5}>
                      Totals (INR)
                    </td>
                    <ReportAmountCell n={sum(metalInrLines, l => l.revenue)} currency="INR" />
                    <ReportAmountCell n={sum(metalInrLines, l => l.cogs)} currency="INR" />
                    <ReportAmountCell
                      n={sum(metalInrLines, l => l.grossProfit)}
                      currency="INR"
                      danger={sum(metalInrLines, l => l.grossProfit) < 0}
                    />
                  </tr>
                  <tr className="border-t border-slate-100 bg-slate-50 font-medium">
                    <td className={icfTd} colSpan={5}>
                      Totals (AED)
                    </td>
                    <ReportAmountCell n={sum(metalAedLines, l => l.revenue)} />
                    <ReportAmountCell n={sum(metalAedLines, l => l.cogs)} />
                    <ReportAmountCell
                      n={sum(metalAedLines, l => l.grossProfit)}
                      danger={sum(metalAedLines, l => l.grossProfit) < 0}
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
