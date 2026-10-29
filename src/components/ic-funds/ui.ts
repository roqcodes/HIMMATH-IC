/** Dense shadcn-inspired tokens scoped to IC Funds. */

import { tableCellAlignClass, type TableCellAlign } from '@/lib/tableCellAlign';

export const icfLabel =
  'mb-1 block text-[11px] font-medium leading-none text-slate-500 dark:text-[var(--theme-text-secondary)]';

export const icfInput =
  'h-8 w-full rounded-lg border border-[var(--theme-border-field)] bg-white px-2.5 text-sm text-slate-900 shadow-[inset_0_1px_2px_rgb(15_23_42/0.04)] outline-none placeholder:text-slate-400 focus-visible:border-[var(--theme-accent)] focus-visible:ring-2 focus-visible:ring-[var(--theme-focus-ring)] dark:bg-[var(--theme-input-bg)] dark:text-[var(--theme-text)] dark:placeholder:text-[var(--theme-text-muted)] dark:shadow-[inset_0_1px_2px_rgb(0_0_0/0.2)]';

export const icfBtnPrimary =
  'inline-flex h-8 items-center justify-center rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white shadow-surface-xs hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50 dark:bg-[var(--theme-surface-raised)] dark:hover:bg-[var(--theme-surface-hover)]';

export const icfBtnOutline =
  'inline-flex h-8 items-center justify-center rounded-lg border border-[var(--theme-border-field)] bg-white px-3 text-sm font-semibold text-slate-700 shadow-surface-xs hover:border-[var(--theme-border-strong)] hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text)] dark:hover:bg-[var(--theme-surface-hover)]';

export const icfBtnGhost =
  'inline-flex h-8 items-center justify-center rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-[var(--theme-text-secondary)] dark:hover:bg-[var(--theme-surface-hover)] dark:hover:text-[var(--theme-text)]';

export const icfCard =
  'overflow-hidden rounded-lg border border-[var(--theme-border-subtle)] bg-white shadow-surface-xs dark:bg-[var(--theme-surface)]';

export const icfTable = 'w-full border-collapse text-left text-sm';

export const icfTheadRow =
  'border-b border-[var(--theme-border)] bg-slate-50/80 dark:bg-[var(--theme-surface-muted)]';

const icfThBase =
  'px-2.5 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-[var(--theme-text-secondary)]';

export function icfThAlign(align: TableCellAlign = 'left') {
  return `${icfThBase} ${tableCellAlignClass[align]}`;
}

/** Default left-aligned header cell. */
export const icfTh = icfThAlign('left');

export function icfTdAlign(align: TableCellAlign = 'left') {
  return `px-2.5 py-2.5 text-sm text-slate-800 dark:text-[var(--theme-text)] ${tableCellAlignClass[align]}`;
}

export const icfTr =
  'border-b border-[var(--theme-border-subtle)] hover:bg-slate-50/80 dark:hover:bg-[var(--theme-surface-hover)]';

export const icfTd = 'px-2.5 py-2.5 text-sm text-slate-800 dark:text-[var(--theme-text)]';

export const icfAccountLink =
  'font-medium text-slate-900 underline-offset-2 hover:text-slate-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 rounded-lg dark:text-[var(--theme-text)] dark:hover:text-[var(--theme-text-secondary)]';

export const icfTableWrap = 'overflow-x-auto';
