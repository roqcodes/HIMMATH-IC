import {
  formatVocDate,
  openTallyLedgerPreview,
  printTallyLedgerPdf,
  type TallyLedgerKpiCard,
  type TallyLedgerLine,
  type TallyLedgerPdfData,
} from '@/lib/icFunds/tallyLedgerPdf';
import type { ICWarehousePLLine, ICWarehousePLWarehouseSummary } from '@/lib/icFunds/warehouseProfit';
import type ExcelJSTypes from 'exceljs';

export type WarehouseStatementExportData = {
  branchName?: string;
  periodLabel: string;
  book: 'ic' | 'metal';
  warehouses: ICWarehousePLWarehouseSummary[];
  lines: ICWarehousePLLine[];
  documentNo?: string;
};

type WarehouseStatementTotals = {
  opening: number;
  incoming: number;
  outgoing: number;
  closing: number;
  revenue: number;
  cost: number;
  profit: number;
};

const numberFormat = '#,##0.00;[Red](#,##0.00);-';
const quantityFormat = '#,##0.####;[Red](#,##0.####);-';
const navy = 'FF172B4D';
const muted = 'FFF1F5F9';
const border = 'FFD8E0EA';

function isMetal(data: WarehouseStatementExportData): boolean {
  return data.book === 'metal';
}

function currency(data: WarehouseStatementExportData): 'AED' | 'INR' {
  return isMetal(data) ? 'INR' : 'AED';
}

function quantityName(data: WarehouseStatementExportData): string {
  return isMetal(data) ? 'grams' : 'INR';
}

function icUnitsInr(units: number): number {
  return units * 100_000;
}

function fmtQty(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 4 });
}

function fmtMoney(n: number): string {
  return Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lineQuantity(line: ICWarehousePLLine, data: WarehouseStatementExportData): number {
  const quantity = isMetal(data) ? Number(line.metalWeightG ?? line.units) || 0 : Number(line.units) || 0;
  return isMetal(data) ? quantity : icUnitsInr(quantity);
}

function lineRevenue(line: ICWarehousePLLine, data: WarehouseStatementExportData): number {
  if (isMetal(data)) {
    if (line.lineKind === 'metal_purchase') return 0;
    if (line.metalDisplayRevenueInr != null) return line.metalDisplayRevenueInr;
    return line.bookedCurrency === 'INR' ? line.revenue : 0;
  }
  return line.lineKind === 'ic_purchase' ? 0 : Number(line.revenue) || 0;
}

function lineCost(line: ICWarehousePLLine, data: WarehouseStatementExportData): number {
  if (isMetal(data)) {
    if (line.metalDisplayCostInr != null) return line.metalDisplayCostInr;
    return line.bookedCurrency === 'INR' ? line.cogs : 0;
  }
  return Number(line.cogs) || 0;
}

function lineProfit(line: ICWarehousePLLine, data: WarehouseStatementExportData): number {
  if (isMetal(data)) {
    if (line.lineKind === 'metal_purchase') return 0;
    if (line.metalDisplayProfitInr != null) return line.metalDisplayProfitInr;
    return line.bookedCurrency === 'INR' ? line.grossProfit : 0;
  }
  return line.lineKind === 'ic_purchase' ? 0 : Number(line.grossProfit) || 0;
}

function lineReference(line: ICWarehousePLLine): string {
  const raw = String(line.referenceId || line.saleId).replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase();
  const prefix = line.lineKind === 'metal_purchase' ? 'MPR' : line.lineKind === 'ic_purchase' ? 'PUR' : 'SAL';
  return `${prefix}-${raw}`;
}

function sortLines(lines: ICWarehousePLLine[]): ICWarehousePLLine[] {
  return [...lines].sort((a, b) => a.saleDate.localeCompare(b.saleDate) || a.eventAtMs - b.eventAtMs);
}

function calculateTotals(data: WarehouseStatementExportData): WarehouseStatementTotals {
  return data.warehouses.reduce(
    (sum, row) => ({
      opening: sum.opening + (isMetal(data) ? row.openingMetalG : icUnitsInr(row.openingUnits)),
      incoming: sum.incoming + (isMetal(data) ? row.metalInG : icUnitsInr(row.unitsIn)),
      outgoing: sum.outgoing + (isMetal(data) ? row.metalOutG : icUnitsInr(row.unitsOut)),
      closing: sum.closing + (isMetal(data) ? row.closingMetalG : icUnitsInr(row.closingUnits)),
      revenue: sum.revenue + (isMetal(data) ? 0 : row.revenue),
      cost: sum.cost + (isMetal(data) ? 0 : row.cogs),
      profit: sum.profit + (isMetal(data) ? row.metalProfitInr : row.grossProfit),
    }),
    { opening: 0, incoming: 0, outgoing: 0, closing: 0, revenue: 0, cost: 0, profit: 0 },
  );
}

function getFinancialTotals(data: WarehouseStatementExportData): Pick<WarehouseStatementTotals, 'revenue' | 'cost' | 'profit'> {
  const rows = sortLines(data.lines.filter(line => (line.settlementMode === 'metal') === isMetal(data)));
  return rows.reduce(
    (sum, line) => ({
      revenue: sum.revenue + lineRevenue(line, data),
      cost: sum.cost + lineCost(line, data),
      profit: sum.profit + lineProfit(line, data),
    }),
    { revenue: 0, cost: 0, profit: 0 },
  );
}

function selectedLines(data: WarehouseStatementExportData): ICWarehousePLLine[] {
  return sortLines(data.lines.filter(line => (line.settlementMode === 'metal') === isMetal(data)));
}

function buildKpiCards(data: WarehouseStatementExportData): TallyLedgerKpiCard[] {
  const stock = calculateTotals(data);
  const financial = getFinancialTotals(data);
  const book = currency(data);
  const qty = quantityName(data);
  return [
    {
      title: 'STOCK MOVEMENT',
      titleAr: `${isMetal(data) ? 'METAL' : 'IC'} · ${qty.toUpperCase()}`,
      openingText: `Opening: ${fmtQty(stock.opening)} ${qty}`,
      debit: stock.incoming,
      credit: stock.outgoing,
      closing: stock.closing,
      closingPrefix: qty,
      debitLabel: 'RECEIVED',
      creditLabel: 'ISSUED',
      closingLabel: 'ON HAND',
      closingText: `${fmtQty(stock.closing)} ${qty}`,
    },
    {
      title: 'PERIOD RESULT',
      titleAr: `${book} · ${selectedLines(data).length} entries`,
      openingText: 'Sales less inventory cost',
      debit: financial.revenue,
      credit: financial.cost,
      closing: financial.profit,
      closingPrefix: book,
      debitLabel: `SALES ${book}`,
      creditLabel: `COST ${book}`,
      closingLabel: `PROFIT ${book}`,
      closingText: `${book} ${fmtMoney(financial.profit)}${financial.profit < 0 ? ' CR' : ' DR'}`,
    },
  ];
}

function statementSheet(data: WarehouseStatementExportData): TallyLedgerPdfData {
  const metal = isMetal(data);
  const book = currency(data);
  const qty = quantityName(data);
  const totals = calculateTotals(data);
  let running = totals.opening;
  const ledger: TallyLedgerLine[] = selectedLines(data).map(line => {
    const purchase = line.lineKind !== 'sale';
    const quantity = lineQuantity(line, data);
    const debit = purchase ? quantity : 0;
    const credit = purchase ? 0 : quantity;
    running += debit - credit;
    const party = data.warehouses.length > 1 ? `${line.warehouseName} / ${line.customerName}` : line.customerName;
    const revenue = lineRevenue(line, data);
    const cost = lineCost(line, data);
    const profit = lineProfit(line, data);
    const txn = purchase ? 'Purchase' : 'Sale';
    const moneySummary = metal
      ? `Sales ${book} ${fmtMoney(revenue)} · cost ${fmtMoney(cost)} · P&L ${fmtMoney(profit)}`
      : `Sales ${book} ${fmtMoney(revenue)} · cost ${fmtMoney(cost)} · profit ${fmtMoney(profit)}`;
    return {
      branch: data.branchName && data.branchName !== 'Himmath HQ' ? data.branchName : 'HO',
      voucher: lineReference(line),
      date: formatVocDate(line.saleDate),
      narration: `${party} · ${txn} · ${fmtQty(quantity)} ${qty} · ${moneySummary}`,
      debit,
      credit,
      balance: running,
    };
  });
  const warehouseName = data.warehouses.length === 1 ? data.warehouses[0].warehouseName : 'All warehouses';
  return {
    title: `Warehouse Statement — ${warehouseName}`,
    tableTitle: metal ? '1. METAL STOCK MOVEMENT' : '1. IC STOCK MOVEMENT',
    tableTitleAr: `${book} · ${qty.toUpperCase()}`,
    tableMeta: `Period: ${data.periodLabel} · ${ledger.length} transactions`,
    partyCode: data.warehouses.length === 1 ? data.warehouses[0].warehouseId.slice(0, 10) : 'ALL',
    partyName: warehouseName,
    partyAddress: `Period: ${data.periodLabel}`,
    currencyLabel: qty,
    openingBalance: totals.opening,
    closingBalance: running,
    lines: ledger,
  };
}

export function buildWarehouseStatementSheets(data: WarehouseStatementExportData): TallyLedgerPdfData[] {
  return [statementSheet(data)];
}

function documentTitle(data: WarehouseStatementExportData): string {
  return `Warehouse Statement · ${isMetal(data) ? 'Metal (INR)' : 'IC stock value (INR)'}`;
}

export function exportWarehouseStatementPdf(data: WarehouseStatementExportData): boolean {
  return printTallyLedgerPdf(buildWarehouseStatementSheets(data), documentTitle(data), {
    documentNo: data.documentNo,
    kpiCards: buildKpiCards(data),
  });
}

export function openWarehouseStatementPreview(data: WarehouseStatementExportData): void {
  openTallyLedgerPreview(buildWarehouseStatementSheets(data), documentTitle(data), {
    documentNo: data.documentNo,
    kpiCards: buildKpiCards(data),
  });
}

function styleSectionRow(row: ExcelJSTypes.Row) {
  row.height = 22;
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: navy } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { vertical: 'middle' };
  });
}

function styleHeaderRow(row: ExcelJSTypes.Row) {
  row.height = 20;
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: muted } };
    cell.font = { bold: true, color: { argb: navy }, size: 10 };
    cell.border = { bottom: { style: 'thin', color: { argb: border } } };
    cell.alignment = { vertical: 'middle' };
  });
}

function styleTitle(sheet: ExcelJSTypes.Worksheet, title: string, subtitle: string, columns: number) {
  sheet.mergeCells(1, 1, 1, columns);
  sheet.getCell(1, 1).value = title;
  sheet.getCell(1, 1).font = { bold: true, size: 18, color: { argb: navy } };
  sheet.getCell(1, 1).alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 30;
  sheet.mergeCells(2, 1, 2, columns);
  sheet.getCell(2, 1).value = subtitle;
  sheet.getCell(2, 1).font = { size: 10, color: { argb: 'FF64748B' } };
  sheet.getRow(2).height = 20;
}

function safeFilenamePart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

export async function exportWarehouseStatementXlsx(data: WarehouseStatementExportData): Promise<void> {
  const imported = await import('exceljs');
  const ExcelJS = imported.default;
  const workbook = new ExcelJS.Workbook();
  const book = currency(data);
  const qty = quantityName(data);
  const metal = isMetal(data);
  const stock = calculateTotals(data);
  const financial = getFinancialTotals(data);
  workbook.creator = 'Himmath';
  workbook.subject = documentTitle(data);
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Summary', { views: [{ showGridLines: false }] });
  summary.columns = [
    { width: 30 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 22 },
  ];
  styleTitle(summary, documentTitle(data), `Period: ${data.periodLabel}   |   Branch: ${data.branchName || 'HO'}`, 6);
  summary.addRow([]);
  const resultSection = summary.addRow(['PERIOD RESULT']);
  summary.mergeCells(resultSection.number, 1, resultSection.number, 6);
  styleSectionRow(resultSection);
  const resultHeader = summary.addRow(['Measure', 'Amount', 'Book']);
  styleHeaderRow(resultHeader);
  const resultRows = [
    ['Sales', financial.revenue, book],
    ['Inventory cost', financial.cost, book],
    [metal ? 'Metal P&L' : 'Gross profit', financial.profit, book],
  ];
  for (const row of resultRows) {
    const excelRow = summary.addRow(row);
    excelRow.getCell(2).numFmt = numberFormat;
  }

  summary.addRow([]);
  const stockSection = summary.addRow(['WAREHOUSE STOCK']);
  summary.mergeCells(stockSection.number, 1, stockSection.number, 6);
  styleSectionRow(stockSection);
  const stockHeaders = summary.addRow([
    'Warehouse', `Opening (${qty})`, `In (${qty})`, `Out (${qty})`, `Closing (${qty})`, `${metal ? 'Metal P&L' : 'Profit'} (${book})`,
  ]);
  styleHeaderRow(stockHeaders);
  for (const warehouse of data.warehouses) {
    const row = summary.addRow([
      warehouse.warehouseName,
      metal ? warehouse.openingMetalG : icUnitsInr(warehouse.openingUnits),
      metal ? warehouse.metalInG : icUnitsInr(warehouse.unitsIn),
      metal ? warehouse.metalOutG : icUnitsInr(warehouse.unitsOut),
      metal ? warehouse.closingMetalG : icUnitsInr(warehouse.closingUnits),
      metal ? warehouse.metalProfitInr : warehouse.grossProfit,
    ]);
    for (let col = 2; col <= 5; col += 1) row.getCell(col).numFmt = metal ? quantityFormat : numberFormat;
    row.getCell(6).numFmt = numberFormat;
  }
  const totalRow = summary.addRow([
    'Total', stock.opening, stock.incoming, stock.outgoing, stock.closing, financial.profit,
  ]);
  totalRow.font = { bold: true };
  totalRow.eachCell(cell => { cell.border = { top: { style: 'thin', color: { argb: border } } }; });
  for (let col = 2; col <= 5; col += 1) totalRow.getCell(col).numFmt = metal ? quantityFormat : numberFormat;
  totalRow.getCell(6).numFmt = numberFormat;
  summary.views = [{ state: 'frozen', ySplit: 5 }];

  const transactions = workbook.addWorksheet('Transactions', { views: [{ showGridLines: false }] });
  transactions.columns = [
    { width: 14 }, { width: 16 }, { width: 24 }, { width: 28 }, { width: 16 },
    { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 },
  ];
  styleTitle(transactions, `${documentTitle(data)} · Transactions`, `Period: ${data.periodLabel}   |   ${selectedLines(data).length} entries`, 9);
  const transactionHeader = transactions.addRow([
    'Date', 'Reference', 'Warehouse', 'Party', 'Activity', metal ? 'Weight (g)' : 'Value (INR)', `Sales (${book})`, `Cost (${book})`, `${metal ? 'P&L' : 'Profit'} (${book})`,
  ]);
  styleHeaderRow(transactionHeader);
  transactions.autoFilter = {
    from: { row: transactionHeader.number, column: 1 },
    to: { row: transactionHeader.number, column: 9 },
  };
  for (const line of selectedLines(data)) {
    const row = transactions.addRow([
      formatVocDate(line.saleDate),
      lineReference(line),
      line.warehouseName,
      line.customerName,
      line.lineKind === 'sale' ? 'Sale' : 'Purchase',
      lineQuantity(line, data),
      lineRevenue(line, data),
      lineCost(line, data),
      lineProfit(line, data),
    ]);
    row.getCell(6).numFmt = metal ? quantityFormat : numberFormat;
    for (let col = 7; col <= 9; col += 1) row.getCell(col).numFmt = numberFormat;
  }
  transactions.views = [{ state: 'frozen', ySplit: 3 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `warehouse-statement-${metal ? 'metal-inr' : 'ic-inr'}-${safeFilenamePart(data.periodLabel) || 'period'}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
