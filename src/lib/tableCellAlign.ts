export type TableCellAlign = 'left' | 'center' | 'right';

/** Static Tailwind classes — do not build with template literals (JIT won't see them). */
export const tableCellAlignClass: Record<TableCellAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

const NUMERIC_HEADER =
  /^(units|total|amount|aed|debit|credit|balance|opening|period|revenue|cogs|profit|rate|vol|delivered|remaining|pending|stock|sold|avg|#)$/i;

/** Default alignment from a column label (English UI headers). */
export function inferTableColumnAlign(column: string): TableCellAlign {
  const normalized = column.trim().toLowerCase().replace(/[^a-z0-9#]+/g, ' ');
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 'left';
  if (tokens.includes('actions') || tokens.includes('status')) return 'center';
  if (tokens.some(t => NUMERIC_HEADER.test(t))) return 'right';
  if (normalized.includes('total aed') || normalized.includes('totalaed')) return 'right';
  return 'left';
}

export function inferTableColumnAligns(columns: string[]): TableCellAlign[] {
  return columns.map(inferTableColumnAlign);
}
