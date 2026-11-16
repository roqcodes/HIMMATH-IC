import { printHtmlDocument } from '@/lib/icFunds/booksExport';

export type TallyLedgerLine = {
  branch: string;
  voucher: string;
  date: string;
  narration: string;
  debit: number;
  credit: number;
  balance: number;
  pending?: boolean;
};

export type TallyLedgerPdfData = {
  title: string;
  tableTitle?: string;
  tableTitleAr?: string;
  tableMeta?: string;
  partyCode?: string;
  partyName: string;
  partyAddress?: string;
  contactPhone?: string;
  contactFax?: string;
  contactEmail?: string;
  currencyLabel: string;
  openingBalance: number;
  closingBalance: number;
  lines: TallyLedgerLine[];
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatTallyAmount(amount: number): string {
  if (!Number.isFinite(amount) || Math.abs(amount) < 0.00005) return '';
  return Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatTallyBalance(balance: number): string {
  if (!Number.isFinite(balance) || Math.abs(balance) < 0.005) return '0.00';
  const side = balance > 0 ? ' DR' : ' CR';
  return `${formatTallyAmount(balance)}${side}`;
}

function formatNum(amount: number): string {
  return formatTallyAmount(amount);
}

function formatBalanceCell(balance: number): string {
  return formatTallyBalance(balance);
}

function voucherPrefix(type: string): string {
  const t = String(type || '').toLowerCase();
  if (t === 'payment' || t === 'payments') return 'PAY';
  if (t === 'receipt' || t === 'receipts') return 'REC';
  if (t === 'contra') return 'CNT';
  if (t === 'sale' || t === 'sales') return 'SAL';
  if (t === 'purchase' || t === 'ic_purchase') return 'PUR';
  if (t === 'metal_purchase') return 'MPR';
  return 'GJV';
}

export function formatTallyVoucherNo(type: string, voucherNo: number | string): string {
  const raw = String(voucherNo ?? '').replace(/\D/g, '');
  const n = raw ? raw.slice(-5) : '0';
  return `${voucherPrefix(type)}-${n.padStart(5, '0')}`;
}

export function formatVocDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export type TallyLedgerKpiCard = {
  title: string;
  titleAr: string;
  openingText: string;
  debit: number;
  credit: number;
  closing: number;
  closingPrefix: string;
};

export type TallyLedgerDocOptions = {
  stack?: boolean;
  kpiCards?: TallyLedgerKpiCard[];
  documentNo?: string;
};

function formatKpiAmount(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatKpiClosing(amount: number, prefix: string): string {
  const n = Number.isFinite(amount) ? amount : 0;
  if (Math.abs(n) < 0.005) return `${prefix} 0.00`;
  const side = n > 0 ? ' Dr' : ' Cr';
  return `${prefix} ${formatKpiAmount(n)}${side}`;
}

export function buildKpiStripHtml(cards: TallyLedgerKpiCard[]): string {
  if (cards.length === 0) return '';
  const cols = cards.map(card => {
    return `
      <div class="kpi-card">
        <div class="kpi-head">
          <span class="kpi-title">${escapeHtml(card.title)} · ${escapeHtml(card.titleAr)}</span>
          <span class="kpi-ob">${escapeHtml(card.openingText)}</span>
        </div>
        <div class="kpi-metrics">
          <div class="kpi-metric">
            <div class="kpi-metric-label">TOTAL DEBIT · مدين</div>
            <div class="kpi-metric-value">${escapeHtml(formatKpiAmount(card.debit))}</div>
          </div>
          <div class="kpi-metric">
            <div class="kpi-metric-label">TOTAL CREDIT · دائن</div>
            <div class="kpi-metric-value kpi-cr">${escapeHtml(formatKpiAmount(card.credit))}</div>
          </div>
          <div class="kpi-metric kpi-close">
            <div class="kpi-metric-label">CLOSING · الرصيد</div>
            <div class="kpi-metric-value kpi-close-val">${escapeHtml(formatKpiClosing(card.closing, card.closingPrefix))}</div>
          </div>
        </div>
      </div>`;
  }).join('');
  return `<section class="kpi-strip">${cols}</section>`;
}

function contactBits(phone?: string, fax?: string): string {
  const tel1 = (phone || '').trim();
  const tel2 = (fax || '').trim();
  return `TEL1. : ${escapeHtml(tel1)}  TEL2. : ${escapeHtml(tel2)}  FAX :`;
}

function renderLedgerTable(data: TallyLedgerPdfData): string {
  const posted = data.lines.filter(l => !l.pending);
  const totalDr = posted.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCr = posted.reduce((s, l) => s + (Number(l.credit) || 0), 0);

  const bodyRows = data.lines
    .map(line => {
      const pending = line.pending
        ? '<div class="pending">PENDING</div>'
        : '';
      return `
        <tr>
          <td class="c-branch">${escapeHtml(line.branch || 'HO')}</td>
          <td class="c-vch">${escapeHtml(line.voucher)}${pending}</td>
          <td class="c-date">${escapeHtml(line.date)}</td>
          <td class="c-narr">${escapeHtml(line.narration)}</td>
          <td class="c-num">${escapeHtml(formatNum(line.debit))}</td>
          <td class="c-num">${escapeHtml(formatNum(line.credit))}</td>
          <td class="c-bal">${escapeHtml(formatBalanceCell(line.balance))}</td>
        </tr>`;
    })
    .join('');

  const heading =
    data.tableTitle ||
    `${data.currencyLabel} TRANSACTIONS`;
  const headingAr = data.tableTitleAr ? ` · ${escapeHtml(data.tableTitleAr)}` : '';
  const meta = data.tableMeta || `Book: ${data.currencyLabel} · ${data.lines.length} Entries`;

  return `
    <section class="ledger-card">
      <div class="ledger-card-head">
        <span>${escapeHtml(heading)}${headingAr}</span>
        <span class="ledger-card-meta">${escapeHtml(meta)}</span>
      </div>
    <table class="ledger">
      <colgroup>
        <col class="c-branch" /><col class="c-vch" /><col class="c-date" /><col class="c-narr" />
        <col class="c-num" /><col class="c-num" /><col class="c-bal" />
      </colgroup>
      <thead>
        <tr>
          <th rowspan="2">Branch</th>
          <th rowspan="2">Voucher</th>
          <th rowspan="2">Voc Date</th>
          <th rowspan="2">Narration</th>
          <th colspan="3" class="amt-group">AMOUNT IN (${escapeHtml(data.currencyLabel)})</th>
        </tr>
        <tr class="subhead">
          <th>Debit</th>
          <th>Credit</th>
          <th>Balance</th>
        </tr>
        <tr class="bf-row">
          <td colspan="6" class="bf-label">Balance B/F</td>
          <td class="c-bal">${escapeHtml(formatBalanceCell(data.openingBalance))}</td>
        </tr>
      </thead>
      <tbody>
        ${bodyRows || `<tr><td colspan="7" class="empty">No movement in this period.</td></tr>`}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4" class="total-label">Total :</td>
          <td class="c-num">${escapeHtml(formatNum(totalDr) || '0.00')}</td>
          <td class="c-num">${escapeHtml(formatNum(totalCr) || '0.00')}</td>
          <td class="c-bal">${escapeHtml(formatBalanceCell(data.closingBalance))}</td>
        </tr>
      </tfoot>
    </table>
    </section>`;
}

function renderPartyHeader(data: TallyLedgerPdfData): string {
  const toHeading = [data.partyCode, data.partyName].filter(Boolean).join(' - ');
  return `
    <div class="top-rule"></div>
    <div class="head-grid">
      <div class="box">
        <div class="box-title">To</div>
        <div class="to-code">${escapeHtml(toHeading || data.partyName)}</div>
        <div class="to-addr">${escapeHtml(data.partyAddress || '.')}</div>
      </div>
      <div class="box">
        <div class="box-title">Contact Details</div>
        <div class="contact-line">${contactBits(data.contactPhone, data.contactFax)}</div>
        <div class="contact-line">Email : ${escapeHtml((data.contactEmail || '').trim())}</div>
      </div>
    </div>`;
}

function renderSheet(
  data: TallyLedgerPdfData,
  pageNo: number,
  pageCount: number,
  extra?: { kpiHtml?: string; extraTables?: TallyLedgerPdfData[]; documentNo?: string },
): string {
  const extraTables = extra?.extraTables ?? [];
  const docBit = extra?.documentNo
    ? `<span class="doc-no">Doc No : ${escapeHtml(extra.documentNo)}</span>`
    : '';
  return `
  <article class="sheet">
    ${renderPartyHeader(data)}
    ${extra?.kpiHtml ?? ''}
    <div class="page-mark">${docBit}<span>Page ${pageNo} of ${pageCount}</span></div>
    ${renderLedgerTable(data)}
    ${extraTables.map(t => renderLedgerTable(t)).join('')}
  </article>`;
}

export function buildTallyLedgerDocumentHtml(
  sheets: TallyLedgerPdfData[],
  docTitle?: string,
  options?: TallyLedgerDocOptions,
): string {
  const list = sheets.length > 0 ? sheets : [];
  const title = docTitle || list[0]?.title || 'Statement';
  const kpiHtml = options?.kpiCards?.length ? buildKpiStripHtml(options.kpiCards) : '';
  const stack = Boolean(options?.stack) && list.length > 0;
  const docNo = options?.documentNo;
  const body = stack
    ? renderSheet(list[0], 1, 1, { kpiHtml, extraTables: list.slice(1), documentNo: docNo })
    : list
        .map((sheet, i) =>
          renderSheet(sheet, i + 1, list.length, {
            kpiHtml: i === 0 ? kpiHtml : undefined,
            documentNo: docNo,
          }),
        )
        .join('');
  const fileTitle = docNo || title;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(fileTitle)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      background: #e5e7eb;
      color: #111;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .preview-bar {
      position: sticky; top: 0; z-index: 20;
      display: flex; justify-content: space-between; align-items: center;
      background: #111827; color: #fff; padding: 8px 16px;
    }
    .preview-bar h4 { margin: 0; font-size: 13px; font-weight: 600; }
    .preview-btn, .close-btn {
      border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; padding: 5px 12px;
    }
    .preview-btn { background: #2563eb; color: #fff; border: 0; }
    .close-btn { background: transparent; color: #cbd5e1; border: 1px solid #475569; }
    .sheet {
      width: 210mm;
      min-height: 297mm;
      max-width: 210mm;
      margin: 16px auto;
      background: #fff;
      padding: 12mm 14mm 12mm;
      box-shadow: 0 8px 24px rgba(0,0,0,.12);
    }
    .sheet + .sheet { page-break-before: always; }
    .kpi-strip {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin: 10px 0 6px;
    }
    .kpi-card {
      border: 1px solid #d1d5db;
      border-radius: 12px;
      padding: 8px 10px 10px;
      background: #fff;
    }
    .kpi-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
      padding-bottom: 7px;
      margin-bottom: 8px;
      border-bottom: 1px solid #f3f4f6;
    }
    .kpi-title { font-size: 11px; font-weight: 700; letter-spacing: 0.02em; }
    .kpi-ob { font-size: 10px; color: #6b7280; white-space: nowrap; }
    .kpi-metrics { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .kpi-metric {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      background: #f9fafb;
      padding: 8px 6px;
      text-align: center;
    }
    .kpi-metric-label {
      font-size: 8px;
      font-weight: 700;
      color: #6b7280;
      letter-spacing: 0.03em;
    }
    .kpi-metric-value {
      margin-top: 4px;
      font-size: 13px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .kpi-cr { color: #dc2626; }
    .kpi-close { background: #f0fdf4; border-color: #bbf7d0; }
    .kpi-close .kpi-metric-label { color: #166534; }
    .kpi-close-val { color: #15803d; font-size: 12px; }
    .top-rule {
      height: 3px;
      background: #111827;
      border-radius: 999px;
      margin-bottom: 10px;
    }
    .head-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 6px;
    }
    .box {
      border: 1px solid #d1d5db;
      border-radius: 12px;
      min-height: 78px;
      padding: 8px 10px 10px;
      background: #fff;
    }
    .box-title {
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #111827;
      border-bottom: 1px solid #f3f4f6;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .to-code { font-weight: 700; font-size: 13px; text-transform: uppercase; }
    .to-addr { color: #6b7280; margin-top: 4px; min-height: 28px; white-space: pre-wrap; }
    .contact-line { margin: 3px 0; color: #374151; }
    .page-mark {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #6b7280;
      margin: 4px 0 0;
    }
    .doc-no { font-weight: 700; color: #111827; letter-spacing: 0.04em; }
    .ledger-card {
      margin: 18px 0;
      border: 1px solid #d1d5db;
      border-radius: 12px;
      overflow: hidden;
      background: #fff;
    }
    .ledger-card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      background: #111827;
      color: #fff;
      padding: 8px 12px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .ledger-card-meta { color: #d1d5db; font-weight: 600; text-transform: none; letter-spacing: 0; }
    table.ledger {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    table.ledger th, table.ledger td {
      border-bottom: 1px solid #e5e7eb;
      padding: 7px 8px;
      vertical-align: top;
    }
    table.ledger thead th {
      background: #f9fafb;
      font-size: 8.5px;
      font-weight: 700;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #111827;
      border-bottom: 1px solid #d1d5db;
    }
    table.ledger tbody tr:last-child td { border-bottom: 0; }
    table.ledger tfoot td {
      background: #f9fafb;
      border-top: 1.5px solid #111827;
      border-bottom: 0;
    }
    .c-branch { width: 8%; text-align: center; }
    .c-vch { width: 12%; }
    .c-date { width: 10%; text-align: center; white-space: nowrap; }
    .c-narr { width: 34%; }
    .c-num { width: 12%; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .c-bal { width: 12%; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; font-weight: 600; }
    .amt-group { text-align: center; }
    .subhead th { font-size: 8.5px; font-weight: 700; }
    .bf-row td { font-weight: 700; background: #fafafa; }
    .bf-label { text-align: right; color: #374151; }
    tfoot td { font-weight: 700; }
    .total-label { text-align: right; }
    .pending { font-size: 8px; font-weight: 700; color: #9a3412; }
    .empty { text-align: center; padding: 16px; color: #6b7280; }
    @media print {
      body { background: #fff; }
      .preview-bar { display: none !important; }
      .sheet {
        width: auto;
        min-height: auto;
        max-width: none;
        margin: 0;
        padding: 0;
        box-shadow: none;
      }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="preview-bar">
    <h4>${escapeHtml(fileTitle)}</h4>
    <div>
      <button type="button" class="preview-btn" onclick="window.print()">Print / Save PDF</button>
      <button type="button" class="close-btn" onclick="window.close()">Close</button>
    </div>
  </div>
  ${body}
</body>
</html>`;
}

export function buildTallyLedgerHtml(data: TallyLedgerPdfData): string {
  return buildTallyLedgerDocumentHtml([data], data.title);
}

export function openTallyLedgerPreview(
  sheets: TallyLedgerPdfData[],
  docTitle?: string,
  options?: TallyLedgerDocOptions,
): void {
  const html = buildTallyLedgerDocumentHtml(sheets, docTitle, options);
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  const pdfName = options?.documentNo || fileTitleFromHtml(html) || docTitle || 'report';
  win.document.title = pdfName;
  win.focus();
}

function fileTitleFromHtml(html: string): string | undefined {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m?.[1]?.trim() || undefined;
}

export function printTallyLedgerPdf(
  sheets: TallyLedgerPdfData[],
  docTitle?: string,
  options?: TallyLedgerDocOptions,
): boolean {
  const html = buildTallyLedgerDocumentHtml(sheets, docTitle, options);
  const fileName = options?.documentNo || fileTitleFromHtml(html);
  return printHtmlDocument(html, fileName);
}
