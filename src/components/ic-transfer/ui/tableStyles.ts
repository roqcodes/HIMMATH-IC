import { inferTableColumnAlign, inferTableColumnAligns, tableCellAlignClass, type TableCellAlign } from '@/lib/tableCellAlign';

/** Shared table header styles — matches Sales: small caps on a slate strip */
export const icTheadRow = 'border-b border-slate-200 bg-slate-50/80';

export const icThClass = (align: TableCellAlign = 'left') =>
  `px-2.5 py-2 ${tableCellAlignClass[align]} text-[11px] font-medium uppercase tracking-wide text-slate-500`;

export const icThSortableClass = (align: TableCellAlign = 'left') =>
  `group cursor-pointer select-none ${icThClass(align)} transition-colors hover:text-slate-800`;

export const icTdClass = (align: TableCellAlign = 'left') =>
  `px-2.5 py-2.5 text-sm whitespace-nowrap text-slate-800 ${tableCellAlignClass[align]}`;

export const icSectionCardClass =
  'overflow-hidden rounded-lg border border-slate-200 bg-white';

/** Dense summary matrix — city overview tables */
export const icCompactTable = 'w-full min-w-0 border-collapse text-left text-xs';

export const icCompactTh = (align: TableCellAlign = 'left') =>
  `border-b border-slate-200 px-2 py-2 ${tableCellAlignClass[align]} text-[10px] font-bold uppercase tracking-wider text-slate-900 sm:px-3`;

export const icCompactMetricLabel =
  'whitespace-nowrap border-b border-slate-50 px-2 py-1.5 text-[11px] font-bold text-slate-900 sm:px-3';

export const icCompactCell =
  'border-b border-slate-50 px-2 py-1.5 text-center font-mono text-xs tabular-nums text-slate-800 sm:px-3';

export const icRowLabelClass = icTdClass('left');

export { inferTableColumnAlign, inferTableColumnAligns };
