/** Dense ERP tokens — IC Funds density, used across Himmath IC. */

import { tableCellAlignClass, type TableCellAlign } from '@/lib/tableCellAlign';

export const asicLabel =
  'mb-0.5 block text-[11px] font-medium leading-none text-slate-500 dark:text-[var(--theme-text-secondary)]';

export const asicInput =
  'h-8 w-full rounded-lg border border-[var(--theme-border-field)] bg-white px-2.5 text-sm text-slate-900 shadow-[inset_0_1px_2px_rgb(15_23_42/0.04)] outline-none placeholder:text-slate-400 focus-visible:border-[var(--theme-accent)] focus-visible:ring-2 focus-visible:ring-[var(--theme-focus-ring)] max-md:h-9 dark:bg-[var(--theme-input-bg)] dark:text-[var(--theme-text)] dark:placeholder:text-[var(--theme-text-muted)] dark:shadow-[inset_0_1px_2px_rgb(0_0_0/0.2)]';

export const asicBtnPrimary =
  'inline-flex h-8 max-md:h-9 items-center justify-center rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white shadow-surface-xs hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50 dark:bg-[var(--theme-surface-raised)] dark:hover:bg-[var(--theme-surface-hover)]';

export const asicBtnOutline =
  'inline-flex h-8 max-md:h-9 items-center justify-center rounded-lg border border-[var(--theme-border-field)] bg-white px-3 text-sm font-semibold text-slate-700 shadow-surface-xs hover:border-[var(--theme-border-strong)] hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text)] dark:hover:bg-[var(--theme-surface-hover)]';

export const asicBtnGhost =
  'inline-flex h-8 max-md:h-9 items-center justify-center rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-[var(--theme-text-secondary)] dark:hover:bg-[var(--theme-surface-hover)] dark:hover:text-[var(--theme-text)]';

export const asicBtnDanger =
  'inline-flex h-8 max-md:h-9 items-center justify-center rounded-lg bg-red-600 px-3 text-sm font-semibold text-white shadow-surface-xs hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50';

export const asicCard =
  'overflow-hidden rounded-lg border border-[var(--theme-border-subtle)] bg-white shadow-surface-xs dark:bg-[var(--theme-surface)]';

/** Sales-page table tokens — use these on every Himmath IC data table. */
export const asicTable = 'w-full border-collapse text-left text-sm';

export const asicTheadRow =
  'border-b border-slate-200 bg-slate-50/80 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-muted)]';

const asicThBase =
  'px-2.5 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-[var(--theme-text-secondary)]';

export function asicThAlign(align: TableCellAlign = 'left') {
  return `${asicThBase} ${tableCellAlignClass[align]}`;
}

export const asicTh = asicThAlign('left');

export function asicTdAlign(align: TableCellAlign = 'left') {
  return `px-2.5 py-2.5 text-sm text-slate-800 dark:text-[var(--theme-text)] ${tableCellAlignClass[align]}`;
}

export const asicTr =
  'border-b border-[var(--theme-border-subtle)] hover:bg-slate-50/80 dark:hover:bg-[var(--theme-surface-hover)]';

export const asicTd = 'px-2.5 py-2.5 text-sm text-slate-800 dark:text-[var(--theme-text)]';

export const asicTableWrap = 'overflow-x-auto';

export const asicPageTitle =
  'text-base font-semibold tracking-tight text-slate-900 dark:text-[var(--theme-text)]';

export const asicNavLink =
  'shrink-0 rounded-lg px-2 py-1 text-xs no-underline text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:px-2.5 sm:py-1.5 sm:text-sm dark:text-[var(--theme-text-secondary)] dark:hover:bg-[var(--theme-surface-hover)] dark:hover:text-[var(--theme-text)]';

export const asicNavLinkActive =
  'rounded-lg bg-slate-100 font-medium text-slate-900 shadow-surface-xs ring-1 ring-slate-200 dark:bg-[var(--theme-surface-hover)] dark:text-[var(--theme-text)] dark:ring-[var(--theme-border)]';

export const asicFormGrid =
  'grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-12 lg:items-start lg:justify-items-stretch [&>*]:min-w-0 lg:[&>*:not([class*="col-span"])]:col-span-6';

export const asicFormGridLoose =
  'grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3';

export const asicTextarea =
  `${asicInput} min-h-[4rem] resize-y py-2 max-md:min-h-[4.5rem]`;
