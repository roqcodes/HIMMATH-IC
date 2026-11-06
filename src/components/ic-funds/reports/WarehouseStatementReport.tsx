'use client';

import React from 'react';
import { fmtICDate, FmtLedgerAed, FmtLedgerInr } from '@/lib/icFunds/format';
import type { ICWarehousePLReport } from '@/lib/icFunds/warehouseProfit';
import { icfTableWrap, icfTd, icfTh, icfThAlign, icfTheadRow } from '@/components/ic-funds/ui';
import { ReportAmountCell } from './reportShared';

function AmountCell({
  n,
  danger,
  currency = 'AED',
}: {
  n: number;
  danger?: boolean;
  currency?: 'AED' | 'INR';
}) {
  return <ReportAmountCell n={n} danger={danger} currency={currency} />;
}

export default function WarehouseStatementReport({
  report,
  warehouses,
  lines,
  periodLabel,
  book,
}: {
  report: ICWarehousePLReport;
  warehouses: ICWarehousePLReport['warehouses'];
  lines: ICWarehousePLReport['lines'];
  periodLabel: string;
  book: 'ic' | 'metal';
}) {
  const totals = report.totals;
  const isIc = book === 'ic';

  return (
    <div>
      <p className="border-b border-slate-200 px-2.5 py-1 text-[11px] text-slate-500">
        {periodLabel} ·{' '}
        {isIc
          ? 'IC units in/out and WAC gross profit by warehouse (AED only).'
          : 'Fine metal grams in/out and commodity P&L by warehouse (INR only).'}
      </p>
      <div className={icfTableWrap}>
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className={icfTheadRow}>
              <th className={icfTh}>Warehouse</th>
              {isIc ? (
                <>
                  <th className={icfThAlign('right')}>Open u</th>
                  <th className={icfThAlign('right')}>In u</th>
                  <th className={icfThAlign('right')}>Out u</th>
                  <th className={icfThAlign('right')}>Close u</th>
                  <th className={icfThAlign('right')}>Revenue (AED)</th>
                  <th className={icfThAlign('right')}>COGS (AED)</th>
                  <th className={icfThAlign('right')}>Gross profit (AED)</th>
                </>
              ) : (
                <>
                  <th className={icfThAlign('right')}>Open g</th>
                  <th className={icfThAlign('right')}>In g</th>
                  <th className={icfThAlign('right')}>Out g</th>
                  <th className={icfThAlign('right')}>Close g</th>
                  <th className={icfThAlign('right')}>Metal P&amp;L (INR)</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {warehouses.length === 0 ? (
              <tr>
                <td className={`${icfTd} py-6 text-center text-slate-500`} colSpan={isIc ? 8 : 6}>
                  No warehouse activity in this period. Try widening the date range or clearing filters.
                </td>
              </tr>
            ) : (
              warehouses.map(row => (
                <tr key={row.warehouseId} className="border-b border-slate-100">
                  <td className={`${icfTd} font-medium`}>{row.warehouseName}</td>
                  {isIc ? (
                    <>
                      <td className={`${icfTd} text-right font-mono tabular-nums`}>
                        {row.openingUnits.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </td>
                      <td className={`${icfTd} text-right font-mono tabular-nums text-emerald-700`}>
                        {row.unitsIn > 0
                          ? row.unitsIn.toLocaleString(undefined, { maximumFractionDigits: 4 })
                          : '—'}
                      </td>
                      <td className={`${icfTd} text-right font-mono tabular-nums text-red-600`}>
                        {row.unitsOut > 0
                          ? row.unitsOut.toLocaleString(undefined, { maximumFractionDigits: 4 })
                          : '—'}
                      </td>
                      <td className={`${icfTd} text-right font-mono tabular-nums`}>
                        {row.closingUnits.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </td>
                      <AmountCell n={row.revenue} />
                      <AmountCell n={row.cogs} danger />
                      <AmountCell n={row.grossProfit} danger={row.grossProfit < 0} />
                    </>
                  ) : (
                    <>
                      <td className={`${icfTd} text-right font-mono tabular-nums`}>
                        {row.openingMetalG > 0
                          ? `${row.openingMetalG.toLocaleString(undefined, { maximumFractionDigits: 4 })} g`
                          : '—'}
                      </td>
                      <td className={`${icfTd} text-right font-mono tabular-nums`}>
                        {row.metalInG > 0
                          ? `${row.metalInG.toLocaleString(undefined, { maximumFractionDigits: 4 })} g`
                          : '—'}
                      </td>
                      <td className={`${icfTd} text-right font-mono tabular-nums`}>
                        {row.metalOutG > 0
                          ? `${row.metalOutG.toLocaleString(undefined, { maximumFractionDigits: 4 })} g`
                          : '—'}
                      </td>
                      <td className={`${icfTd} text-right font-mono tabular-nums`}>
                        {row.closingMetalG > 0
                          ? `${row.closingMetalG.toLocaleString(undefined, { maximumFractionDigits: 4 })} g`
                          : '—'}
                      </td>
                      <AmountCell n={row.metalProfitInr} currency="INR" danger={row.metalProfitInr < 0} />
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
          {warehouses.length > 0 ? (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold dark:bg-[var(--theme-surface-elevated)]">
                <td className={icfTd}>Total</td>
                {isIc ? (
                  <>
                    <td className={`${icfTd} text-right font-mono tabular-nums`}>
                      {warehouses
                        .reduce((s, w) => s + w.openingUnits, 0)
                        .toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </td>
                    <td className={icfTd} />
                    <td className={icfTd} />
                    <td className={`${icfTd} text-right font-mono tabular-nums`}>
                      {warehouses
                        .reduce((s, w) => s + w.closingUnits, 0)
                        .toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </td>
                    <AmountCell n={totals.revenue} />
                    <AmountCell n={totals.cogs} danger />
                    <AmountCell n={totals.grossProfit} danger={totals.grossProfit < 0} />
                  </>
                ) : (
                  <>
                    <td className={icfTd} colSpan={4} />
                    <AmountCell n={totals.metalProfitInr} currency="INR" danger={totals.metalProfitInr < 0} />
                  </>
                )}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {lines.length > 0 ? (
        <div className="border-t border-slate-200 dark:border-[var(--theme-border)]">
          <p className="border-b border-slate-100 bg-slate-50/80 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            {isIc ? 'IC cash sales (detail)' : 'Metal sales (detail)'}
          </p>
          <div className={icfTableWrap}>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className={icfTheadRow}>
                  <th className={icfTh}>Date</th>
                  <th className={icfTh}>Ref</th>
                  <th className={icfTh}>Warehouse</th>
                  {isIc ? (
                    <>
                      <th className={icfThAlign('right')}>Units</th>
                      <th className={icfThAlign('right')}>Revenue</th>
                      <th className={icfThAlign('right')}>COGS</th>
                      <th className={icfThAlign('right')}>GP</th>
                    </>
                  ) : (
                    <>
                      <th className={icfThAlign('right')}>Grams</th>
                      <th className={icfThAlign('right')}>P&amp;L (INR)</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {lines
                  .filter(line =>
                    isIc
                      ? line.settlementMode === 'cash'
                      : line.settlementMode === 'metal' && line.bookedCurrency === 'INR',
                  )
                  .map(line => (
                    <tr key={line.saleId} className="border-b border-slate-100">
                      <td className={`${icfTd} tabular-nums`}>{fmtICDate(line.saleDate)}</td>
                      <td className={`${icfTd} font-mono text-xs`}>{line.saleId}</td>
                      <td className={icfTd}>{line.warehouseName}</td>
                      {isIc ? (
                        <>
                          <td className={`${icfTd} text-right font-mono tabular-nums`}>
                            {line.units.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          </td>
                          <AmountCell n={line.revenue} />
                          <AmountCell n={line.cogs} danger />
                          <AmountCell n={line.grossProfit} danger={line.grossProfit < 0} />
                        </>
                      ) : (
                        <>
                          <td className={`${icfTd} text-right font-mono tabular-nums`}>
                            {line.metalWeightG != null
                              ? `${line.metalWeightG.toLocaleString(undefined, { maximumFractionDigits: 4 })} g`
                              : '—'}
                          </td>
                          <AmountCell n={line.grossProfit} currency="INR" danger={line.grossProfit < 0} />
                        </>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
