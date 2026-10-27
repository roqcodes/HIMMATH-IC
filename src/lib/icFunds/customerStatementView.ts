import { IC_FUNDS_BASE_CURRENCY } from '@/lib/icFunds/currencyPolicy';
import { roundFxCalc, formatFxAmount } from '@/lib/icTransfer/saleFxProfit';
import type { ICFundStatementLine } from '@/types';

/** Ledger lines that must not appear on customer-facing statements. */
export const CUSTOMER_STATEMENT_INTERNAL_REFS = new Set([
  'ic_sale_profit',
  'ic_sale_fx_profit',
  'ic_sale_cogs',
]);

export type CustomerStatementCurrencyMode = 'aed' | 'customer';

export type CustomerStatementView = {
  currency: string;
  mode: CustomerStatementCurrencyMode;
  defaultFxRate: number;
  lines: ICFundStatementLine[];
  opening: number;
  closing: number;
};

/** AED ledger amount → customer wallet currency (rate = foreign per 1 AED). */
export function aedToCustomerCurrency(aed: number, fxRate: number): number {
  if (!Number.isFinite(aed) || aed === 0) return 0;
  if (!Number.isFinite(fxRate) || fxRate <= 0) return aed;
  return roundFxCalc(aed * fxRate);
}

export function filterCustomerVisibleLines(lines: ICFundStatementLine[]): ICFundStatementLine[] {
  return lines.filter(line => !line.internalOnly);
}

export function buildCustomerStatementView(
  lines: ICFundStatementLine[],
  opts: {
    customerCurrency: string;
    mode: CustomerStatementCurrencyMode;
    defaultFxRate: number;
    openingAed: number;
    closingAed: number;
    forCustomerExport?: boolean;
  },
): CustomerStatementView {
  const currency = opts.customerCurrency.toUpperCase();
  const useCustomer = opts.mode === 'customer' && currency !== IC_FUNDS_BASE_CURRENCY;

  const visible =
    opts.forCustomerExport || useCustomer
      ? filterCustomerVisibleLines(lines)
      : lines;

  if (!useCustomer) {
    return {
      currency: IC_FUNDS_BASE_CURRENCY,
      mode: 'aed',
      defaultFxRate: opts.defaultFxRate,
      opening: opts.openingAed,
      closing: opts.closingAed,
      lines: visible,
    };
  }

  let running = aedToCustomerCurrency(opts.openingAed, opts.defaultFxRate);
  const converted: ICFundStatementLine[] = [];

  for (const line of visible) {
    if (line.voucherNo === 0) {
      converted.push({
        ...line,
        balance: running,
      });
      continue;
    }

    const rate = line.fxRate && line.fxRate > 0 ? line.fxRate : opts.defaultFxRate;
    const debit =
      line.status === 'pending'
        ? 0
        : line.foreignDebit != null && line.debit > 0
          ? roundFxCalc(line.foreignDebit)
          : aedToCustomerCurrency(line.debit, rate);
    const credit =
      line.status === 'pending'
        ? 0
        : line.foreignCredit != null && line.credit > 0
          ? roundFxCalc(line.foreignCredit)
          : aedToCustomerCurrency(line.credit, rate);
    if (line.status === 'active') {
      running = roundFxCalc(running + debit - credit);
    }

    converted.push({
      ...line,
      debit,
      credit,
      balance: roundFxCalc(running),
      fxRate: rate,
    });
  }

  const openingLine = converted.find(l => l.voucherNo === 0);
  const opening = openingLine?.balance ?? aedToCustomerCurrency(opts.openingAed, opts.defaultFxRate);
  const closing = converted.length ? converted[converted.length - 1].balance : opening;

  return {
    currency,
    mode: 'customer',
    defaultFxRate: opts.defaultFxRate,
    opening,
    closing,
    lines: converted,
  };
}

export function formatStatementAmount(amount: number, _currency: string): string {
  return formatFxAmount(amount);
}

export function statementCsvFilename(customerName: string, currency: string): string {
  const safe = customerName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'customer';
  const date = new Date().toISOString().slice(0, 10);
  return `${safe}_statement_${currency}_${date}.csv`;
}

export function buildCustomerStatementCsv(
  view: CustomerStatementView,
  customerName: string,
): string {
  const rows: string[][] = [
    ['Account statement', customerName],
    ['Currency', view.currency],
    ['Opening balance', formatStatementAmount(view.opening, view.currency)],
    [],
    ['Date', 'Voucher', 'Type', 'Particulars', 'Debit', 'Credit', 'Balance', 'Notes'],
  ];

  for (const line of filterCustomerVisibleLines(view.lines)) {
    if (line.voucherNo === 0) continue;
    rows.push([
      line.date || '',
      line.voucherNo ? String(line.voucherNo) : '',
      line.voucherType,
      line.particulars,
      line.debit ? formatStatementAmount(line.debit, view.currency) : '',
      line.credit ? formatStatementAmount(line.credit, view.currency) : '',
      formatStatementAmount(line.balance, view.currency),
      line.notes || '',
    ]);
  }

  rows.push([]);
  rows.push(['Closing balance', formatStatementAmount(view.closing, view.currency)]);

  return rows
    .map(cols =>
      cols
        .map(cell => {
          const s = String(cell ?? '');
          if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(','),
    )
    .join('\n');
}

export function downloadCustomerStatementCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function printHtmlDocument(html: string): boolean {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = iframe.contentDocument ?? frameWindow?.document;
  if (!frameWindow || !frameDoc) {
    iframe.remove();
    return false;
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 500);
  };

  const triggerPrint = () => {
    frameWindow.focus();
    frameWindow.print();
    cleanup();
  };

  if (frameDoc.readyState === 'complete') {
    window.setTimeout(triggerPrint, 150);
  } else {
    iframe.addEventListener('load', () => window.setTimeout(triggerPrint, 150), { once: true });
  }

  return true;
}

export function printCustomerStatementPdf(
  view: CustomerStatementView,
  customerName: string,
  branchName?: string,
): boolean {
  const lines = filterCustomerVisibleLines(view.lines).filter(l => l.voucherNo !== 0);
  const safeName = escapeHtml(customerName);
  const safeBranch = branchName ? escapeHtml(branchName) : '';
  const safeCurrency = escapeHtml(view.currency);
  const statementDate = escapeHtml(new Date().toLocaleDateString());

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Statement — ${safeName}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; color: #1e293b; margin: 32px; font-size: 12px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color: #64748b; margin-bottom: 20px; font-size: 11px; }
  .summary { display: flex; gap: 24px; margin-bottom: 20px; }
  .summary div { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; min-width: 140px; }
  .summary label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; }
  .summary strong { font-size: 16px; font-variant-numeric: tabular-nums; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; border-bottom: 1px solid #e2e8f0; padding: 8px 6px; }
  td { padding: 7px 6px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  @media print { body { margin: 16px; } }
</style></head><body>
  <h1>${safeName}</h1>
  <p class="meta">Account statement${safeBranch ? ` · ${safeBranch}` : ''} · ${safeCurrency} · ${statementDate}</p>
  <div class="summary">
    <div><label>Opening</label><strong>${formatStatementAmount(view.opening, view.currency)} ${safeCurrency}</strong></div>
    <div><label>Closing</label><strong>${formatStatementAmount(view.closing, view.currency)} ${safeCurrency}</strong></div>
  </div>
  <table>
    <thead><tr>
      <th>Date</th><th>#</th><th>Type</th><th>Particulars</th>
      <th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th>
    </tr></thead>
    <tbody>
      ${lines
        .map(line => {
          const notes = line.notes
            ? `<br/><span style="color:#94a3b8;font-size:10px">${escapeHtml(line.notes)}</span>`
            : '';
          return `<tr>
        <td>${escapeHtml(line.date || '—')}</td>
        <td>${line.voucherNo || '—'}</td>
        <td>${escapeHtml(line.voucherType)}</td>
        <td>${escapeHtml(line.particulars)}${notes}</td>
        <td class="num">${line.debit ? formatStatementAmount(line.debit, view.currency) : '—'}</td>
        <td class="num">${line.credit ? formatStatementAmount(line.credit, view.currency) : '—'}</td>
        <td class="num">${formatStatementAmount(line.balance, view.currency)}</td>
      </tr>`;
        })
        .join('')}
    </tbody>
  </table>
</body></html>`;

  return printHtmlDocument(html);
}
