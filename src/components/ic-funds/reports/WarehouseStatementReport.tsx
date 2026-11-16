'use client';

import React from 'react';
import { fmtICDate, FmtLedgerAmount, fmtLedgerInrPlain } from '@/lib/icFunds/format';
import type { ICWarehousePLLine, ICWarehousePLReport } from '@/lib/icFunds/warehouseProfit';
import { icfTableWrap, icfTd, icfTh, icfThAlign, icfTheadRow } from '@/components/ic-funds/ui';
import { ReportSegmentTabs } from './reportShared';

function icUnitsInr(units: number): number {
  return units * 100_000;
}

function fmtInr(n: number): string {
  return fmtLedgerInrPlain(n);
}

function fmtGrams(n: number): string {
  if (!n) return '—';
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 4 })} g`;
}

function metalRevenue(line: ICWarehousePLLine): number {
  if (line.lineKind === 'metal_purchase') return 0;
  if (line.metalDisplayRevenueInr != null) return line.metalDisplayRevenueInr;
  return line.bookedCurrency === 'INR' ? line.revenue : 0;
}

function metalCost(line: ICWarehousePLLine): number {
  if (line.metalDisplayCostInr != null) return line.metalDisplayCostInr;
  return line.bookedCurrency === 'INR' ? line.cogs : 0;
}

function metalProfit(line: ICWarehousePLLine): number {
  if (line.lineKind === 'metal_purchase') return 0;
  if (line.metalDisplayProfitInr != null) return line.metalDisplayProfitInr;
  return line.bookedCurrency === 'INR' ? line.grossProfit : 0;
}

function reference(line: ICWarehousePLLine): string {
  const id = (line.referenceId || line.saleId).replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase();
  const prefix = line.lineKind === 'metal_purchase' ? 'MPR' : line.lineKind === 'ic_purchase' ? 'PUR' : 'SAL';
  return `${prefix}-${id}`;
}

function SummaryMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 border-l-2 border-slate-200 px-3 py-1 first:border-l-0 first:pl-0 last:pr-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 truncate font-mono text-xl font-semibold tracking-tight text-slate-950 tabular-nums">{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-slate-500">{detail}</p>
    </div>
  );
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pb-2 sm:px-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="text-[11px] text-slate-500">{detail}</p>
    </div>
  );
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
  const isMetal = book === 'metal';
  const detailLines = lines.filter(line => (line.settlementMode === 'metal') === isMetal);
  const stock = warehouses.reduce(
    (sum, row) => ({
      opening: sum.opening + (isMetal ? row.openingMetalG : row.openingUnits),
      incoming: sum.incoming + (isMetal ? row.metalInG : row.unitsIn),
      outgoing: sum.outgoing + (isMetal ? row.metalOutG : row.unitsOut),
      closing: sum.closing + (isMetal ? row.closingMetalG : row.closingUnits),
    }),
    { opening: 0, incoming: 0, outgoing: 0, closing: 0 },
  );
  const profit = isMetal ? report.totals.metalProfitInr : report.totals.grossProfit;
  const fmtStock = isMetal ? fmtGrams : (value: number) => fmtInr(icUnitsInr(value));

  return (
    <div className="divide-y divide-slate-200">
      <header className="flex flex-wrap items-end justify-between gap-4 px-4 py-4 sm:px-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Warehouse statement</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
            {isMetal ? 'Metal stock · INR' : 'IC stock · INR'}
          </h2>
          <p className="mt-1 text-xs text-slate-500">Inventory movement and transaction result by warehouse</p>
        </div>
        <ReportSegmentTabs
          label="Book"
          value={book}
          onChange={onBookChange}
          options={[
            { id: 'ic', label: 'IC · INR' },
            { id: 'metal', label: 'Metal · INR' },
          ]}
        />
      </header>

      <section className="grid grid-cols-2 gap-y-4 px-4 py-4 sm:grid-cols-4 sm:px-5" aria-label="Period summary">
        <SummaryMetric label="Opening" value={fmtStock(stock.opening)} detail={isMetal ? 'Brought forward' : 'INR value brought forward'} />
        <SummaryMetric label={isMetal ? 'Purchased' : 'Received'} value={fmtStock(stock.incoming)} detail={isMetal ? 'Metal received' : 'INR value received'} />
        <SummaryMetric label={isMetal ? 'Sold' : 'Issued'} value={fmtStock(stock.outgoing)} detail={isMetal ? 'Metal issued' : 'INR value issued'} />
        <SummaryMetric
          label="Closing stock"
          value={fmtStock(stock.closing)}
          detail={`${isMetal ? 'Metal P&L' : 'IC profit'} ${isMetal ? 'INR' : 'AED'} ${Math.abs(profit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${profit < 0 ? ' loss' : ''}`}
        />
      </section>

      <section className="py-4">
        <SectionHeading title="Warehouse balances" detail={`${warehouses.length} warehouse${warehouses.length === 1 ? '' : 's'}`} />
        <div className={`${icfTableWrap} border-y border-slate-200`}>
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className={icfTheadRow}>
                <th className={icfTh}>Warehouse</th>
                <th className={icfThAlign('right')}>{isMetal ? 'Opening g' : 'Opening INR'}</th>
                <th className={icfThAlign('right')}>{isMetal ? 'In g' : 'Received INR'}</th>
                <th className={icfThAlign('right')}>{isMetal ? 'Out g' : 'Issued INR'}</th>
                <th className={icfThAlign('right')}>{isMetal ? 'Closing g' : 'Closing INR'}</th>
                <th className={icfThAlign('right')}>{isMetal ? 'P&L (INR)' : 'Profit (AED)'}</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.length === 0 ? (
                <tr><td className={`${icfTd} py-7 text-center text-slate-500`} colSpan={6}>No warehouse activity in this period.</td></tr>
              ) : warehouses.map(row => (
                <tr key={row.warehouseId} className="border-b border-slate-100 last:border-0">
                  <td className={`${icfTd} font-medium text-slate-900`}>{row.warehouseName}</td>
                  <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtStock(isMetal ? row.openingMetalG : row.openingUnits)}</td>
                  <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtStock(isMetal ? row.metalInG : row.unitsIn)}</td>
                  <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtStock(isMetal ? row.metalOutG : row.unitsOut)}</td>
                  <td className={`${icfTd} text-right font-mono font-semibold tabular-nums`}>{fmtStock(isMetal ? row.closingMetalG : row.closingUnits)}</td>
                  <td className={`${icfTd} text-right font-mono font-medium tabular-nums ${((isMetal ? row.metalProfitInr : row.grossProfit) < 0) ? 'text-red-600' : 'text-slate-900'}`}>
                    <FmtLedgerAmount amount={isMetal ? row.metalProfitInr : row.grossProfit} book={isMetal ? 'INR' : 'AED'} />
                  </td>
                </tr>
              ))}
            </tbody>
            {warehouses.length > 0 ? (
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                  <td className={icfTd}>Total</td>
                  <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtStock(stock.opening)}</td>
                  <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtStock(stock.incoming)}</td>
                  <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtStock(stock.outgoing)}</td>
                  <td className={`${icfTd} text-right font-mono tabular-nums`}>{fmtStock(stock.closing)}</td>
                  <td className={`${icfTd} text-right font-mono tabular-nums`}><FmtLedgerAmount amount={profit} book={isMetal ? 'INR' : 'AED'} /></td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>

      <section className="py-4">
        <SectionHeading title="Transactions" detail={`${detailLines.length} purchase${detailLines.length === 1 ? '' : 's'} and sales`} />
        <div className={icfTableWrap}>
          <table className="w-full min-w-[1020px] text-left text-sm">
            <thead>
              <tr className={icfTheadRow}>
                <th className={icfTh}>Date</th>
                <th className={icfTh}>Reference</th>
                <th className={icfTh}>Warehouse</th>
                <th className={icfTh}>Party</th>
                <th className={icfTh}>Activity</th>
                <th className={icfThAlign('right')}>{isMetal ? 'Weight' : 'Value (INR)'}</th>
                <th className={icfThAlign('right')}>{isMetal ? 'Sales (INR)' : 'Sales (AED)'}</th>
                <th className={icfThAlign('right')}>{isMetal ? 'Cost (INR)' : 'Cost (AED)'}</th>
                <th className={icfThAlign('right')}>{isMetal ? 'Profit (INR)' : 'Profit (AED)'}</th>
              </tr>
            </thead>
            <tbody>
              {detailLines.length === 0 ? (
                <tr><td className={`${icfTd} py-8 text-center text-slate-500`} colSpan={9}>No transactions for this book in the selected period.</td></tr>
              ) : detailLines.map(line => {
                const purchase = line.lineKind !== 'sale';
                const revenue = isMetal ? metalRevenue(line) : purchase ? 0 : line.revenue;
                const cost = isMetal ? metalCost(line) : line.cogs;
                const rowProfit = isMetal ? metalProfit(line) : purchase ? 0 : line.grossProfit;
                return (
                  <tr key={`${line.lineKind}-${line.saleId}`} className="border-b border-slate-100 last:border-0">
                    <td className={`${icfTd} whitespace-nowrap tabular-nums`}>{fmtICDate(line.saleDate)}</td>
                    <td className={`${icfTd} whitespace-nowrap font-mono text-xs text-slate-600`}>{reference(line)}</td>
                    <td className={`${icfTd} font-medium text-slate-800`}>{line.warehouseName}</td>
                    <td className={`${icfTd} max-w-[12rem] truncate`} title={line.customerName}>{line.customerName}</td>
                    <td className={icfTd}>{purchase ? 'Purchase' : 'Sale'}</td>
                    <td className={`${icfTd} text-right font-mono tabular-nums`}>{isMetal ? fmtGrams(line.metalWeightG ?? line.units) : fmtInr(icUnitsInr(line.units))}</td>
                    <td className={`${icfTd} text-right font-mono tabular-nums`}><FmtLedgerAmount amount={revenue} book={isMetal ? 'INR' : 'AED'} /></td>
                    <td className={`${icfTd} text-right font-mono tabular-nums`}><FmtLedgerAmount amount={cost} book={isMetal ? 'INR' : 'AED'} /></td>
                    <td className={`${icfTd} text-right font-mono font-medium tabular-nums ${rowProfit < 0 ? 'text-red-600' : 'text-slate-900'}`}><FmtLedgerAmount amount={rowProfit} book={isMetal ? 'INR' : 'AED'} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
