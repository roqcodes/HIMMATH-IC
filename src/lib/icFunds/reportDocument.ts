import type { ICFundsReportId } from '@/lib/icFunds/nav';

/** Stable report type codes — used in names, PDFs, and files. */
export const REPORT_DOC_CODES: Record<ICFundsReportId, string> = {
  'all-vouchers': 'DAY',
  'cash-bank': 'CBB',
  statement: 'SOA',
  'd-expenses': 'EXP',
  receivables: 'RCP',
  'trial-balance': 'TBL',
  'profit-loss': 'PNL',
  'balance-sheet': 'BLS',
  'fund-trades': 'FND',
  'metal-trades': 'MTL',
  'capital-register': 'CAP',
  'warehouse-pl': 'WHS',
};

const SEQ_PREFIX = 'himmath.icf.report-seq';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function reportDateStamp(at = new Date()): string {
  return `${at.getFullYear()}${pad2(at.getMonth() + 1)}${pad2(at.getDate())}`;
}

export function reportCode(id: ICFundsReportId): string {
  return REPORT_DOC_CODES[id];
}

function nextDailySeq(code: string, day: string): number {
  if (typeof window === 'undefined') {
    return Number(String(Date.now()).slice(-5)) || 1;
  }
  try {
    const key = `${SEQ_PREFIX}.${code}.${day}`;
    const next = (Number(window.localStorage.getItem(key) || '0') || 0) + 1;
    window.localStorage.setItem(key, String(next));
    return next;
  } catch {
    return Number(String(Date.now()).slice(-5)) || 1;
  }
}

/** Unique document id, series-ordered per report code per day: SOA-20261116-00003 */
export function issueReportDocumentNo(id: ICFundsReportId, at = new Date()): string {
  const code = reportCode(id);
  const day = reportDateStamp(at);
  const seq = nextDailySeq(code, day);
  return `${code}-${day}-${String(seq).padStart(5, '0')}`;
}

export function reportNamedTitle(id: ICFundsReportId, title: string): string {
  return `${reportCode(id)} · ${title}`;
}

export function reportFileName(documentNo: string, ext: string): string {
  return `${documentNo}.${ext.replace(/^\./, '')}`;
}
