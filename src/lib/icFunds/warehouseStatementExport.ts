import {
  formatTallyVoucherNo,
  formatVocDate,
  openTallyLedgerPreview,
  printTallyLedgerPdf,
  type TallyLedgerLine,
  type TallyLedgerPdfData,
} from '@/lib/icFunds/tallyLedgerPdf';
import type { ICWarehousePLLine, ICWarehousePLWarehouseSummary } from '@/lib/icFunds/warehouseProfit';

export type WarehouseStatementExportData = {
  branchName?: string;
  periodLabel: string;
  book: 'ic' | 'metal';
  warehouses: ICWarehousePLWarehouseSummary[];
  lines: ICWarehousePLLine[];
  documentNo?: string;
};

function fmtQty(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0';
  return n.toLocaleString('en-IN', { maximumFractionDigits: 4 });
}

function fmtMoney(n: number): string {
  return Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sortLines(lines: ICWarehousePLLine[]): ICWarehousePLLine[] {
  return [...lines].sort((a, b) => {
    const da = a.saleDate.localeCompare(b.saleDate);
    if (da !== 0) return da;
    return (a.eventAtMs || 0) - (b.eventAtMs || 0);
  });
}

function metalCost(line: ICWarehousePLLine): number {
  if (line.metalDisplayCostInr != null) return line.metalDisplayCostInr;
  return line.bookedCurrency === 'INR' ? line.cogs : 0;
}

function metalRevenue(line: ICWarehousePLLine): number {
  if (line.lineKind === 'metal_purchase') return 0;
  if (line.metalDisplayRevenueInr != null) return line.metalDisplayRevenueInr;
  return line.bookedCurrency === 'INR' ? line.revenue : 0;
}

function sheetForWarehouse(
  warehouse: ICWarehousePLWarehouseSummary,
  allLines: ICWarehousePLLine[],
  book: 'ic' | 'metal',
  branchName: string,
  opts?: { prefixWarehouse?: boolean },
): TallyLedgerPdfData {
  const lines = sortLines(
    warehouse.warehouseId === 'ALL'
      ? allLines
      : allLines.filter(l => l.warehouseId === warehouse.warehouseId),
  );
  const isMetal = book === 'metal';
  const bookLines = isMetal
    ? lines.filter(l => l.settlementMode === 'metal')
    : lines.filter(l => l.settlementMode !== 'metal');

  const opening = isMetal ? 0 : warehouse.openingUnits * (warehouse.weightedAvgRate || 0);
  let running = opening;
  const ledger: TallyLedgerLine[] = [];

  for (const line of bookLines) {
    const isPurchase = line.lineKind === 'ic_purchase' || line.lineKind === 'metal_purchase';
    const type = isPurchase ? (line.lineKind === 'metal_purchase' ? 'metal_purchase' : 'purchase') : 'sale';
    let debit = 0;
    let credit = 0;
    let narration = '';

    const party = opts?.prefixWarehouse ? `${line.warehouseName} / ${line.customerName}` : line.customerName;

    if (isMetal) {
      const cost = metalCost(line);
      const sale = metalRevenue(line);
      if (isPurchase) {
        debit = cost;
        running += debit;
        narration = `${party} - ${fmtQty(line.metalWeightG || 0)} g INR ${fmtMoney(cost)}`;
      } else {
        credit = cost || sale;
        running -= credit;
        narration = `${party} - ${fmtQty(line.metalWeightG || 0)} g INR ${fmtMoney(sale || cost)}`;
      }
    } else if (isPurchase) {
      debit = line.cogs;
      running += debit;
      narration = `${party} - ${fmtQty(line.units)} UNITS AED ${fmtMoney(line.cogs)}`;
    } else {
      credit = line.cogs > 0 ? line.cogs : line.revenue;
      running -= credit;
      narration = `${party} - ${fmtQty(line.units)} UNITS AED ${fmtMoney(line.revenue)}`;
    }

    ledger.push({
      branch: branchName,
      voucher: formatTallyVoucherNo(type, line.saleId),
      date: formatVocDate(line.saleDate),
      narration,
      debit,
      credit,
      balance: running,
    });
  }

  const last = ledger[ledger.length - 1]?.balance ?? opening;

  return {
    title: `Warehouse Statement — ${warehouse.warehouseName}`,
    tableTitle: isMetal ? '1. METAL TRANSACTIONS' : '1. IC TRANSACTIONS',
    tableTitleAr: isMetal ? 'معاملات المعدن' : 'معاملات الصندوق',
    tableMeta: `Book: ${isMetal ? 'INR' : 'AED'} · ${ledger.length} Entries`,
    partyCode: warehouse.warehouseId.slice(0, 10),
    partyName: warehouse.warehouseName,
    partyAddress: '.',
    currencyLabel: isMetal ? 'INR' : 'AED',
    openingBalance: opening,
    closingBalance: last,
    lines: ledger,
  };
}

export function buildWarehouseStatementSheets(data: WarehouseStatementExportData): TallyLedgerPdfData[] {
  const branch = data.branchName && data.branchName !== 'Himmath HQ' ? data.branchName : 'HO';
  if (data.warehouses.length === 1) {
    return [sheetForWarehouse(data.warehouses[0], data.lines, data.book, branch)];
  }

  const combined: ICWarehousePLWarehouseSummary = {
    warehouseId: 'ALL',
    warehouseName: 'WAREHOUSE STATEMENT',
    openingUnits: data.warehouses.reduce((s, w) => s + w.openingUnits, 0),
    unitsIn: 0,
    unitsOut: 0,
    closingUnits: 0,
    openingMetalG: 0,
    metalInG: 0,
    metalOutG: 0,
    closingMetalG: 0,
    purchaseUnits: 0,
    purchaseCost: 0,
    weightedAvgRate: 0,
    saleUnits: 0,
    revenue: 0,
    cogs: 0,
    grossProfit: 0,
    metalProfitAed: 0,
    metalProfitInr: 0,
    metalSoldG: 0,
  };
  const openingValue = data.warehouses.reduce(
    (s, w) => s + w.openingUnits * (w.weightedAvgRate || 0),
    0,
  );
  combined.weightedAvgRate = combined.openingUnits > 0 ? openingValue / combined.openingUnits : 0;

  return [sheetForWarehouse(combined, data.lines, data.book, branch, { prefixWarehouse: true })];
}

export function exportWarehouseStatementPdf(data: WarehouseStatementExportData): boolean {
  const sheets = buildWarehouseStatementSheets(data);
  return printTallyLedgerPdf(sheets, 'Warehouse Statement', { documentNo: data.documentNo });
}

export function openWarehouseStatementPreview(data: WarehouseStatementExportData): void {
  const sheets = buildWarehouseStatementSheets(data);
  openTallyLedgerPreview(sheets, 'Warehouse Statement', { documentNo: data.documentNo });
}
