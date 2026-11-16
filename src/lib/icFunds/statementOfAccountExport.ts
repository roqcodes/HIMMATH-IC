import {
  buildTallyLedgerDocumentHtml,
  formatTallyVoucherNo,
  formatVocDate,
  openTallyLedgerPreview,
  printTallyLedgerPdf,
  type TallyLedgerKpiCard,
  type TallyLedgerLine,
  type TallyLedgerPdfData,
} from '@/lib/icFunds/tallyLedgerPdf';
import type { ICFundAccount, ICFundStatementLine } from '@/types';

export type StatementOfAccountExportData = {
  account: ICFundAccount;
  branchName?: string;
  periodLabel: string;
  startDate?: string;
  endDate?: string;
  inrLedgerLinked?: boolean;
  preferredBook?: 'AED' | 'INR';
  documentNo?: string;
  aedStatement: {
    opening: number;
    closing: number;
    lines: ICFundStatementLine[];
  } | null;
  inrStatement: {
    opening: number;
    closing: number;
    lines: ICFundStatementLine[];
    accountName?: string;
  } | null;
};

function partyCode(account: ICFundAccount): string {
  const id = String(account.id || '').trim();
  if (/^[A-Za-z]{1,4}\d+/.test(id)) return id.split('-')[0] ?? id;
  if (account.sourceId) return String(account.sourceId).slice(0, 12);
  return id.slice(0, 10);
}

function narrationFor(line: ICFundStatementLine): string {
  const parts = [line.particulars, line.notes].map(s => String(s || '').trim()).filter(Boolean);
  return parts.join(' - ') || '-';
}

function toLedgerLines(
  lines: ICFundStatementLine[],
  branchName: string,
): TallyLedgerLine[] {
  return lines
    .filter(l => l.voucherNo !== 0)
    .map(line => ({
      branch: line.branchName || branchName || 'HO',
      voucher: formatTallyVoucherNo(line.voucherType, line.voucherNo),
      date: formatVocDate(line.date),
      narration: narrationFor(line),
      debit: Number(line.debit) || 0,
      credit: Number(line.credit) || 0,
      balance: Number(line.balance) || 0,
      pending: line.status === 'pending',
    }));
}

function periodTotals(lines: ICFundStatementLine[]): { debit: number; credit: number } {
  return lines
    .filter(l => l.voucherNo !== 0 && l.status !== 'pending')
    .reduce(
      (acc, l) => {
        acc.debit += Number(l.debit) || 0;
        acc.credit += Number(l.credit) || 0;
        return acc;
      },
      { debit: 0, credit: 0 },
    );
}

function formatOb(amount: number, book: 'AED' | 'INR'): string {
  const n = Number.isFinite(amount) ? Math.abs(amount) : 0;
  const num = n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return book === 'INR' ? `₹${num}` : `AED ${num}`;
}

function sheetFor(
  data: StatementOfAccountExportData,
  book: 'AED' | 'INR',
): TallyLedgerPdfData {
  const stmt = book === 'AED' ? data.aedStatement : data.inrStatement;
  const branchRaw = data.branchName || 'HO';
  const branch = branchRaw === 'Himmath HQ' ? 'HO' : branchRaw;
  const name =
    book === 'INR' && data.inrStatement?.accountName
      ? data.inrStatement.accountName
      : data.account.name;

  const lineCount = (stmt?.lines ?? []).filter(l => l.voucherNo !== 0).length;
  const isAed = book === 'AED';

  return {
    title: `Statement of Account — ${name}`,
    tableTitle: isAed ? '1. AED TRANSACTIONS' : '2. INR TRANSACTIONS',
    tableTitleAr: isAed ? 'معاملات الدرهم الإماراتي' : 'معاملات الروبية الهندية',
    tableMeta: `Book: ${book} · ${lineCount} Entries`,
    partyCode: partyCode(data.account),
    partyName: data.account.name,
    partyAddress: '.',
    contactPhone: data.account.phone,
    contactEmail: data.account.email,
    currencyLabel: book,
    openingBalance: stmt?.opening ?? 0,
    closingBalance: stmt?.closing ?? 0,
    lines: toLedgerLines(stmt?.lines ?? [], branch),
  };
}

function kpiCardsFor(data: StatementOfAccountExportData): TallyLedgerKpiCard[] {
  const aed = periodTotals(data.aedStatement?.lines ?? []);
  const inr = periodTotals(data.inrStatement?.lines ?? []);
  const inrName = data.inrStatement?.accountName;
  return [
    {
      title: 'AED LEDGER',
      titleAr: 'دفتر الدرهم',
      openingText: `OB: ${formatOb(data.aedStatement?.opening ?? 0, 'AED')}`,
      debit: aed.debit,
      credit: aed.credit,
      closing: data.aedStatement?.closing ?? 0,
      closingPrefix: 'AED',
    },
    {
      title: 'INR LEDGER',
      titleAr: 'دفتر الروبية',
      openingText: `OB: ${formatOb(data.inrStatement?.opening ?? 0, 'INR')}${inrName ? ` · ${inrName}` : ''}`,
      debit: inr.debit,
      credit: inr.credit,
      closing: data.inrStatement?.closing ?? 0,
      closingPrefix: '₹',
    },
  ];
}

export function buildStatementOfAccountSheets(data: StatementOfAccountExportData): TallyLedgerPdfData[] {
  return [sheetFor(data, 'AED'), sheetFor(data, 'INR')];
}

function docOptions(data: StatementOfAccountExportData) {
  return {
    stack: true as const,
    kpiCards: kpiCardsFor(data),
    documentNo: data.documentNo,
  };
}

export function buildStatementOfAccountHtml(data: StatementOfAccountExportData): string {
  return buildTallyLedgerDocumentHtml(
    buildStatementOfAccountSheets(data),
    `Statement of Account — ${data.account.name}`,
    docOptions(data),
  );
}

export function exportStatementOfAccountPdf(data: StatementOfAccountExportData): boolean {
  return printTallyLedgerPdf(
    buildStatementOfAccountSheets(data),
    `Statement of Account — ${data.account.name}`,
    docOptions(data),
  );
}

export function openStatementOfAccountPreview(data: StatementOfAccountExportData): void {
  openTallyLedgerPreview(
    buildStatementOfAccountSheets(data),
    `Statement of Account — ${data.account.name}`,
    docOptions(data),
  );
}
