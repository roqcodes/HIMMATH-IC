import { TRADE_NAME, TRADE_ADDRESS, TRADE_PHONE, TRADE_LOGO_URL } from '@/lib/brand';
import { accountTypeLabel, IC_FUND_VOUCHER_LABELS } from '@/lib/icFunds/constants';
import { fmtICDate } from '@/lib/icFunds/format';
import { printHtmlDocument } from '@/lib/icFunds/booksExport';
import type { ICFundAccount, ICFundStatementLine } from '@/types';

export type StatementOfAccountExportData = {
  account: ICFundAccount;
  branchName?: string;
  periodLabel: string;
  startDate?: string;
  endDate?: string;
  /** True when this party has a linked INR metal ledger (even if no rows in period). */
  inrLedgerLinked?: boolean;
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

function escapeHtml(value: unknown): string {
  const s = String(value ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatAedNum(amount: number): string {
  if (!Number.isFinite(amount)) return '0.00';
  const abs = Math.abs(amount);
  return abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function formatInrNum(amount: number): string {
  if (!Number.isFinite(amount)) return '0.00';
  const abs = Math.abs(amount);
  return abs.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatBalanceWithSide(balance: number, currency: 'AED' | 'INR'): string {
  if (Math.abs(balance) < 0.005) {
    return currency === 'AED' ? 'AED 0.00' : '₹0.00';
  }
  const prefix = currency === 'AED' ? 'AED ' : '₹';
  const num = currency === 'AED' ? formatAedNum(balance) : formatInrNum(balance);
  const side = balance > 0 ? ' Dr' : ' Cr';
  return `${prefix}${num}${side}`;
}

export function buildStatementOfAccountHtml(data: StatementOfAccountExportData): string {
  const { account, branchName = 'Himmath HQ', periodLabel, aedStatement, inrStatement } = data;
  const hasAed = Boolean(aedStatement);
  const hasInr = Boolean(inrStatement);

  const now = new Date();
  const generatedAt = now.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const aedLines = (aedStatement?.lines ?? []).filter(l => l.voucherNo !== 0);
  const inrLines = (inrStatement?.lines ?? []).filter(l => l.voucherNo !== 0);

  const aedOpening = hasAed ? (aedStatement!.opening ?? 0) : 0;
  const inrOpening = hasInr ? (inrStatement!.opening ?? 0) : 0;

  const aedTotalDr = aedLines.reduce((s, l) => s + (l.status === 'pending' ? 0 : l.debit), 0);
  const aedTotalCr = aedLines.reduce((s, l) => s + (l.status === 'pending' ? 0 : l.credit), 0);
  const aedClosing = hasAed ? (aedStatement!.closing ?? aedOpening + aedTotalDr - aedTotalCr) : 0;

  const inrTotalDr = inrLines.reduce((s, l) => s + (l.status === 'pending' ? 0 : l.debit), 0);
  const inrTotalCr = inrLines.reduce((s, l) => s + (l.status === 'pending' ? 0 : l.credit), 0);
  const inrClosing = hasInr ? (inrStatement!.closing ?? inrOpening + inrTotalDr - inrTotalCr) : 0;

  const logoUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${TRADE_LOGO_URL}`
      : TRADE_LOGO_URL;

  const renderTableRows = (
    lines: ICFundStatementLine[],
    opening: number,
    currency: 'AED' | 'INR',
  ): string => {
    const rowsHtml: string[] = [];

    // Opening balance row
    rowsHtml.push(`
      <tr style="background: #fafafa; font-weight: 500; border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 6px 8px; color: #4b5563;">—</td>
        <td style="padding: 6px 8px; font-family: ui-monospace, monospace; color: #6b7280;">OB</td>
        <td style="padding: 6px 8px; color: #374151;">Opening</td>
        <td style="padding: 6px 8px; color: #111827; font-weight: 600;">Opening Balance Brought Forward</td>
        <td style="padding: 6px 8px; text-align: right; color: #9ca3af;">—</td>
        <td style="padding: 6px 8px; text-align: right; color: #9ca3af;">—</td>
        <td style="padding: 6px 8px; text-align: right; font-family: ui-monospace, monospace; font-weight: 600; color: #111827;">
          ${escapeHtml(formatBalanceWithSide(opening, currency))}
        </td>
        <td style="padding: 6px 8px; color: #6b7280; font-size: 9px;">Brought forward</td>
      </tr>
    `);

    if (lines.length === 0) {
      rowsHtml.push(`
        <tr>
          <td colspan="8" style="padding: 16px; text-align: center; color: #6b7280; font-style: italic;">
            No movement in this period (opening balance only).
          </td>
        </tr>
      `);
    } else {
      for (const line of lines) {
        const vchTypeLabel = IC_FUND_VOUCHER_LABELS[line.voucherType] || line.voucherType || 'Journal';
        const isPending = line.status === 'pending';

        const drText = line.debit > 0
          ? currency === 'AED' ? formatAedNum(line.debit) : formatInrNum(line.debit)
          : '—';
        const crText = line.credit > 0
          ? currency === 'AED' ? formatAedNum(line.credit) : formatInrNum(line.credit)
          : '—';

        rowsHtml.push(`
          <tr style="border-bottom: 1px solid #f3f4f6; ${isPending ? 'background: #fffbeb;' : ''}">
            <td style="padding: 6px 8px; white-space: nowrap; color: #1f2937;">${escapeHtml(fmtICDate(line.date))}</td>
            <td style="padding: 6px 8px; font-family: ui-monospace, monospace; color: #4b5563;">
              ${escapeHtml(line.voucherNo)}
              ${isPending ? '<span style="font-size: 8px; background: #fef3c7; color: #b45309; padding: 1px 3px; border-radius: 2px; margin-left: 2px; font-weight: bold;">PENDING</span>' : ''}
            </td>
            <td style="padding: 6px 8px; color: #4b5563;">${escapeHtml(vchTypeLabel)}</td>
            <td style="padding: 6px 8px; color: #111827; font-weight: 500;">${escapeHtml(line.particulars || '—')}</td>
            <td style="padding: 6px 8px; text-align: right; font-family: ui-monospace, monospace; color: ${line.debit > 0 ? '#111827' : '#9ca3af'};">
              ${escapeHtml(drText)}
            </td>
            <td style="padding: 6px 8px; text-align: right; font-family: ui-monospace, monospace; color: ${line.credit > 0 ? '#dc2626' : '#9ca3af'};">
              ${escapeHtml(crText)}
            </td>
            <td style="padding: 6px 8px; text-align: right; font-family: ui-monospace, monospace; font-weight: 600; color: #111827;">
              ${escapeHtml(formatBalanceWithSide(line.balance, currency))}
            </td>
            <td style="padding: 6px 8px; color: #6b7280; font-size: 9px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHtml(line.notes || '—')}
            </td>
          </tr>
        `);
      }
    }

    return rowsHtml.join('');
  };

  const aedRows = renderTableRows(aedLines, aedOpening, 'AED');
  const inrRows = renderTableRows(inrLines, inrOpening, 'INR');

  const title = `Statement of Account — ${account.name}`;

  const kpiGridCols = hasAed && hasInr ? '1fr 1fr' : '1fr';

  const aedKpiBlock = !hasAed
    ? ''
    : `
      <div style="border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 10px; background: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #f3f4f6; padding-bottom: 5px; margin-bottom: 7px;">
          <span style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #111827;">
            AED LEDGER · دفتر الدرهم
          </span>
          <span style="font-size: 9px; color: #4b5563;">
            OB: <strong>AED ${escapeHtml(formatAedNum(aedOpening))}</strong>
          </span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; text-align: center;">
          <div style="background: #f9fafb; padding: 5px 3px; border-radius: 5px; border: 1px solid #e5e7eb;">
            <div style="font-size: 7.5px; font-weight: 600; text-transform: uppercase; color: #4b5563; letter-spacing: 0.03em;">
              TOTAL DEBIT · مدين
            </div>
            <div style="font-size: 11px; font-weight: 700; color: #111827; margin-top: 1px; font-family: ui-monospace, monospace;">
              ${escapeHtml(formatAedNum(aedTotalDr))}
            </div>
          </div>
          <div style="background: #f9fafb; padding: 5px 3px; border-radius: 5px; border: 1px solid #e5e7eb;">
            <div style="font-size: 7.5px; font-weight: 600; text-transform: uppercase; color: #4b5563; letter-spacing: 0.03em;">
              TOTAL CREDIT · دائن
            </div>
            <div style="font-size: 11px; font-weight: 700; color: #dc2626; margin-top: 1px; font-family: ui-monospace, monospace;">
              ${escapeHtml(formatAedNum(aedTotalCr))}
            </div>
          </div>
          <div style="background: #f0fdf4; padding: 5px 3px; border-radius: 5px; border: 1px solid #bbf7d0;">
            <div style="font-size: 7.5px; font-weight: 600; text-transform: uppercase; color: #166534; letter-spacing: 0.03em;">
              CLOSING · الرصيد
            </div>
            <div style="font-size: 11px; font-weight: 700; color: #15803d; margin-top: 1px; font-family: ui-monospace, monospace;">
              ${escapeHtml(formatBalanceWithSide(aedClosing, 'AED'))}
            </div>
          </div>
        </div>
      </div>`;

  const inrLedgerLinked = data.inrLedgerLinked ?? false;
  const inrKpiBlock =
    !hasInr && !inrLedgerLinked
      ? `
      <div style="border: 1px dashed #d1d5db; border-radius: 8px; padding: 12px 10px; background: #fafafa; color: #4b5563; font-size: 10px; line-height: 1.45;">
        <strong style="color: #111827;">INR ledger</strong> — No metal (INR) book is linked to this account. Linked counterparties show both AED and INR in one export when applicable.
      </div>`
      : !hasInr
        ? `
      <div style="border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 10px; background: #ffffff;">
        <div style="font-size: 10px; color: #6b7280; padding: 8px 4px;">
          INR statement could not be loaded for this period.
        </div>
      </div>`
        : `
      <div style="border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 10px; background: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #f3f4f6; padding-bottom: 5px; margin-bottom: 7px;">
          <span style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #111827;">
            INR LEDGER · دفتر الروبية
          </span>
          <span style="font-size: 9px; color: #4b5563;">
            OB: <strong>₹${escapeHtml(formatInrNum(inrOpening))}</strong>
            ${inrStatement?.accountName ? ` · ${escapeHtml(inrStatement.accountName)}` : ''}
          </span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; text-align: center;">
          <div style="background: #f9fafb; padding: 5px 3px; border-radius: 5px; border: 1px solid #e5e7eb;">
            <div style="font-size: 7.5px; font-weight: 600; text-transform: uppercase; color: #4b5563; letter-spacing: 0.03em;">
              TOTAL DEBIT · مدين
            </div>
            <div style="font-size: 11px; font-weight: 700; color: #111827; margin-top: 1px; font-family: ui-monospace, monospace;">
              ${escapeHtml(formatInrNum(inrTotalDr))}
            </div>
          </div>
          <div style="background: #f9fafb; padding: 5px 3px; border-radius: 5px; border: 1px solid #e5e7eb;">
            <div style="font-size: 7.5px; font-weight: 600; text-transform: uppercase; color: #4b5563; letter-spacing: 0.03em;">
              TOTAL CREDIT · دائن
            </div>
            <div style="font-size: 11px; font-weight: 700; color: #dc2626; margin-top: 1px; font-family: ui-monospace, monospace;">
              ${escapeHtml(formatInrNum(inrTotalCr))}
            </div>
          </div>
          <div style="background: #f0fdf4; padding: 5px 3px; border-radius: 5px; border: 1px solid #bbf7d0;">
            <div style="font-size: 7.5px; font-weight: 600; text-transform: uppercase; color: #166534; letter-spacing: 0.03em;">
              CLOSING · الرصيد
            </div>
            <div style="font-size: 11px; font-weight: 700; color: #15803d; margin-top: 1px; font-family: ui-monospace, monospace;">
              ${escapeHtml(formatBalanceWithSide(inrClosing, 'INR'))}
            </div>
          </div>
        </div>
      </div>`;

  const kpiSectionHtml = `
    <section style="display: grid; grid-template-columns: ${kpiGridCols}; gap: 10px; margin-bottom: 14px;">
      ${aedKpiBlock}
      ${inrKpiBlock}
    </section>`;

  const aedTableSectionHtml = !hasAed
    ? ''
    : `
    <section style="border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; margin-bottom: 16px; background: #ffffff;">
      <div style="background: #111827; color: #ffffff; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;">
          1. AED TRANSACTIONS · معاملات الدرهم الإماراتي
        </span>
        <span style="font-size: 8.5px; color: #d1d5db;">
          Book: AED · ${aedLines.length} Entries
        </span>
      </div>
      <table>
        <thead>
          <tr style="background: #f9fafb; border-bottom: 1px solid #d1d5db;">
            <th style="padding: 6px 8px; text-align: left; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #111827; width: 75px;">DATE</th>
            <th style="padding: 6px 8px; text-align: left; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #111827; width: 45px;">#</th>
            <th style="padding: 6px 8px; text-align: left; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #111827; width: 65px;">TYPE</th>
            <th style="padding: 6px 8px; text-align: left; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #111827;">PARTICULARS</th>
            <th style="padding: 6px 8px; text-align: right; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #111827; width: 90px;">DEBIT (AED)</th>
            <th style="padding: 6px 8px; text-align: right; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #111827; width: 90px;">CREDIT (AED)</th>
            <th style="padding: 6px 8px; text-align: right; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #111827; width: 110px;">BALANCE (AED)</th>
            <th style="padding: 6px 8px; text-align: left; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #111827; width: 120px;">REMARKS</th>
          </tr>
        </thead>
        <tbody>
          ${aedRows}
        </tbody>
        <tfoot>
          <tr style="background: #f9fafb; border-top: 1.5px solid #111827; font-weight: 700;">
            <td colspan="4" style="padding: 7px 8px; text-align: right; text-transform: uppercase; font-size: 8.5px; letter-spacing: 0.04em;">
              AED period movement / closing:
            </td>
            <td style="padding: 7px 8px; text-align: right; font-family: ui-monospace, monospace; color: #111827;">
              ${escapeHtml(formatAedNum(aedTotalDr))}
            </td>
            <td style="padding: 7px 8px; text-align: right; font-family: ui-monospace, monospace; color: #dc2626;">
              ${escapeHtml(formatAedNum(aedTotalCr))}
            </td>
            <td style="padding: 7px 8px; text-align: right; font-family: ui-monospace, monospace; color: #15803d; font-size: 11px;">
              ${escapeHtml(formatBalanceWithSide(aedClosing, 'AED'))}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </section>`;

  const inrTableSectionHtml = !hasInr
    ? ''
    : `
    <section class="${hasAed ? 'page-break' : ''}" style="border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; margin-bottom: 14px; background: #ffffff;">
      <div style="background: #111827; color: #ffffff; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;">
          ${hasAed ? '2.' : '1.'} INR TRANSACTIONS · معاملات الروبية الهندية
        </span>
        <span style="font-size: 8.5px; color: #d1d5db;">
          Book: INR · ${inrLines.length} Entries
        </span>
      </div>
      <table>
        <thead>
          <tr style="background: #f9fafb; border-bottom: 1px solid #d1d5db;">
            <th style="padding: 6px 8px; text-align: left; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #111827; width: 75px;">DATE</th>
            <th style="padding: 6px 8px; text-align: left; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #111827; width: 45px;">#</th>
            <th style="padding: 6px 8px; text-align: left; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #111827; width: 65px;">TYPE</th>
            <th style="padding: 6px 8px; text-align: left; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #111827;">PARTICULARS</th>
            <th style="padding: 6px 8px; text-align: right; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #111827; width: 90px;">DEBIT (INR)</th>
            <th style="padding: 6px 8px; text-align: right; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #111827; width: 90px;">CREDIT (INR)</th>
            <th style="padding: 6px 8px; text-align: right; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #111827; width: 110px;">BALANCE (INR)</th>
            <th style="padding: 6px 8px; text-align: left; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #111827; width: 120px;">REMARKS</th>
          </tr>
        </thead>
        <tbody>
          ${inrRows}
        </tbody>
        <tfoot>
          <tr style="background: #f9fafb; border-top: 1.5px solid #111827; font-weight: 700;">
            <td colspan="4" style="padding: 7px 8px; text-align: right; text-transform: uppercase; font-size: 8.5px; letter-spacing: 0.04em;">
              INR period movement / closing:
            </td>
            <td style="padding: 7px 8px; text-align: right; font-family: ui-monospace, monospace; color: #111827;">
              ${escapeHtml(formatInrNum(inrTotalDr))}
            </td>
            <td style="padding: 7px 8px; text-align: right; font-family: ui-monospace, monospace; color: #dc2626;">
              ${escapeHtml(formatInrNum(inrTotalCr))}
            </td>
            <td style="padding: 7px 8px; text-align: right; font-family: ui-monospace, monospace; color: #15803d; font-size: 11px;">
              ${escapeHtml(formatBalanceWithSide(inrClosing, 'INR'))}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </section>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      color: #000000;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 10.5px;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      max-width: 210mm;
      min-height: 297mm;
      margin: 16px auto;
      background: #ffffff;
      padding: 12mm 14mm 10mm 14mm;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    }
    .preview-bar {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: #090d16;
      color: #ffffff;
      padding: 10px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.25);
    }
    .preview-bar h4 {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
    }
    .preview-btn {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 6px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s;
    }
    .preview-btn:hover {
      background: #1d4ed8;
    }
    .close-btn {
      background: transparent;
      color: #94a3b8;
      border: 1px solid #334155;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
    }
    .close-btn:hover {
      color: #ffffff;
      border-color: #64748b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .preview-bar {
        display: none !important;
      }
      .sheet {
        margin: 0 auto;
        padding: 0;
        box-shadow: none;
        max-width: 100%;
        min-height: auto;
      }
      tr {
        page-break-inside: avoid;
      }
      thead {
        display: table-header-group;
      }
      .page-break {
        page-break-before: always;
      }
    }
  </style>
</head>
<body>
  <div class="preview-bar">
    <div>
      <h4>${escapeHtml(TRADE_NAME)} · Statement of Account</h4>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 1px;">
        ${escapeHtml(account.name)} · ${escapeHtml(periodLabel)}
      </div>
    </div>
    <div style="display: flex; gap: 8px; align-items: center;">
      <button type="button" class="preview-btn" onclick="window.print()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
        Print / Save PDF
      </button>
      <button type="button" class="close-btn" onclick="window.close()">Close</button>
    </div>
  </div>

  <article class="sheet">
    <!-- 1. Header with Real Brand Logo & Trade Info -->
    <header style="display: flex; align-items: flex-start; justify-content: space-between; gap: 14px;">
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <img
          src="${escapeHtml(logoUrl)}"
          alt="Himmath Gold & Diamonds"
          style="width: 44px; height: 44px; object-fit: contain; flex-shrink: 0;"
          onerror="this.style.display='none'"
        />
        <div>
          <h1 style="font-size: 15px; font-weight: 700; margin: 0; line-height: 1.15; color: #000000; letter-spacing: -0.01em;">
            ${escapeHtml(TRADE_NAME)}
          </h1>
          <p style="font-size: 10px; color: #4b5563; margin: 3px 0 0; line-height: 1.2;">
            ${escapeHtml(TRADE_ADDRESS)}
          </p>
          <p style="font-size: 10px; color: #4b5563; margin: 2px 0 0; line-height: 1.2;">
            ${escapeHtml(TRADE_PHONE)}
          </p>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="display: inline-block; font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 3px 8px; border: 1px solid #111827; border-radius: 4px; color: #111827; background: #ffffff;">
          OFFICIAL STATEMENT
        </div>
        <div style="font-size: 8.5px; color: #6b7280; margin-top: 4px;" dir="rtl" lang="ar">
          كشف حساب رسمي
        </div>
      </div>
    </header>

    <!-- 2. Double Black Line Divider -->
    <div style="margin: 12px 0 14px;">
      <div style="height: 2px; background: #000000; width: 100%;"></div>
      <div style="height: 1px; background: #000000; width: 100%; margin-top: 2px;"></div>
    </div>

    <!-- 3. Title Row with Arabic Translation -->
    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
      <h2 style="font-size: 21px; font-weight: 700; margin: 0; color: #000000; letter-spacing: -0.02em;">
        STATEMENT OF ACCOUNT
      </h2>
      <span style="font-size: 15px; font-weight: 500; color: #1f2937;" dir="rtl" lang="ar">
        كشف الحساب
      </span>
    </div>

    <!-- 4. Account Details Card (Similar to Invoice Meta 4-Column Card) -->
    <section style="border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; margin-bottom: 14px; background: #ffffff;">
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 1px solid #e5e7eb; background: #f9fafb;">
        <div style="padding: 8px 10px; border-right: 1px solid #e5e7eb;">
          <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #4b5563;">
            <span>ACCOUNT</span><span dir="rtl">الحساب</span>
          </div>
          <div style="font-size: 12.5px; font-weight: 700; color: #000000; margin-top: 3px; word-break: break-word; text-transform: uppercase;">
            ${escapeHtml(account.name)}
          </div>
        </div>

        <div style="padding: 8px 10px; border-right: 1px solid #e5e7eb;">
          <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #4b5563;">
            <span>CATEGORY</span><span dir="rtl">النوع</span>
          </div>
          <div style="font-size: 11.5px; font-weight: 600; color: #111827; margin-top: 3px;">
            ${escapeHtml(accountTypeLabel(account.accountType))}
          </div>
        </div>

        <div style="padding: 8px 10px; border-right: 1px solid #e5e7eb;">
          <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #4b5563;">
            <span>BRANCH</span><span dir="rtl">الفرع</span>
          </div>
          <div style="font-size: 11.5px; font-weight: 600; color: #111827; margin-top: 3px;">
            ${escapeHtml(branchName)}
          </div>
        </div>

        <div style="padding: 8px 10px;">
          <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #4b5563;">
            <span>PERIOD</span><span dir="rtl">الفترة</span>
          </div>
          <div style="font-size: 11.5px; font-weight: 600; color: #111827; margin-top: 3px;">
            ${escapeHtml(periodLabel)}
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); padding: 7px 10px; font-size: 9.5px; color: #4b5563; background: #ffffff;">
        <div><strong style="color: #111827;">Contact:</strong> ${escapeHtml(account.phone || '—')}</div>
        <div><strong style="color: #111827;">Email:</strong> ${escapeHtml(account.email || '—')}</div>
        <div><strong style="color: #111827;">Generated:</strong> ${escapeHtml(generatedAt)}</div>
        <div><strong style="color: #111827;">Ledger ID:</strong> ${escapeHtml(account.id)}</div>
      </div>
    </section>

    ${kpiSectionHtml}
    ${aedTableSectionHtml}
    ${inrTableSectionHtml}

    <!-- Document Footer -->
    <footer style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; font-size: 8.5px; color: #6b7280;">
      <div>
        <strong style="color: #111827;">${escapeHtml(TRADE_NAME)}</strong> · Official Statement of Account
      </div>
      <div>
        Printed on ${escapeHtml(generatedAt)}
      </div>
    </footer>
  </article>
</body>
</html>`;
}

export function exportStatementOfAccountPdf(data: StatementOfAccountExportData): boolean {
  const html = buildStatementOfAccountHtml(data);
  return printHtmlDocument(html);
}

export function openStatementOfAccountPreview(data: StatementOfAccountExportData): void {
  const html = buildStatementOfAccountHtml(data);
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
}
