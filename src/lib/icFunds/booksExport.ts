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

export function printReportArea(elementId: string): void {
  const node = document.getElementById(elementId);
  if (!node) return;
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>Report</title>
    <style>
      body { font-family: system-ui, sans-serif; font-size: 12px; padding: 16px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; }
      th { background: #f8fafc; }
      .text-right { text-align: right; }
    </style></head><body>${node.innerHTML}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}
