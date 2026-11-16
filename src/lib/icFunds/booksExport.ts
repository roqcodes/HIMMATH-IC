/** Escape a cell for CSV download. */
function csvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
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

function extractHtmlTitle(html: string): string | undefined {
  const match = html.match(/<title>([^<]*)<\/title>/i);
  const raw = match?.[1]?.trim();
  return raw || undefined;
}

/** Chrome uses the focused document's title as the default PDF name — sync parent + iframe. */
export function printHtmlDocument(html: string, fileName?: string): boolean {
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

  const printTitle = (fileName || extractHtmlTitle(html) || 'report').trim();

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();
  frameDoc.title = printTitle;
  iframe.title = printTitle;

  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 500);
  };

  const triggerPrint = () => {
    const prevParentTitle = document.title;
    document.title = printTitle;
    frameDoc.title = printTitle;

    const restoreParentTitle = () => {
      document.title = prevParentTitle;
    };
    window.addEventListener('afterprint', restoreParentTitle, { once: true });
    window.setTimeout(restoreParentTitle, 4000);

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

const REPORT_PRINT_STYLES = `
  body { font-family: system-ui, sans-serif; font-size: 12px; padding: 16px; color: #1e293b; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  .meta { color: #64748b; margin-bottom: 12px; font-size: 11px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f8fafc; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
  .text-right { text-align: right; }
  @media print { body { margin: 12px; } }
`;

/** Export PDF via print dialog — stays in same tab (hidden iframe). */
export function exportReportPdfFromElement(
  elementId: string,
  opts?: { title?: string; subtitle?: string; fileName?: string },
): boolean {
  const node = document.getElementById(elementId);
  if (!node) return false;
  const heading = escapeHtml(opts?.title ?? 'Financial report');
  const fileTitle = escapeHtml(opts?.fileName || opts?.title || 'Financial report');
  const subtitle = opts?.subtitle ? `<p class="meta">${escapeHtml(opts.subtitle)}</p>` : '';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${fileTitle}</title>
    <style>${REPORT_PRINT_STYLES}</style></head><body>
    <h1>${heading}</h1>${subtitle}${node.innerHTML}</body></html>`;
  return printHtmlDocument(html, opts?.fileName);
}

/** Opens printable preview in a new tab (View button). */
export function openReportPreviewNewTab(
  elementId: string,
  opts?: { title?: string; subtitle?: string; fileName?: string },
): void {
  const node = document.getElementById(elementId);
  if (!node) return;
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) return;
  const heading = escapeHtml(opts?.title ?? 'Financial report');
  const fileTitle = escapeHtml(opts?.fileName || opts?.title || 'Financial report');
  const subtitle = opts?.subtitle ? `<p class="meta">${escapeHtml(opts.subtitle)}</p>` : '';
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${fileTitle}</title>
    <style>${REPORT_PRINT_STYLES}</style></head><body>
    <h1>${heading}</h1>${subtitle}${node.innerHTML}</body></html>`);
  win.document.close();
  win.document.title = opts?.fileName || fileTitle;
  win.focus();
}

/** @deprecated Use exportReportPdfFromElement */
export function printReportArea(elementId: string): void {
  exportReportPdfFromElement(elementId);
}
