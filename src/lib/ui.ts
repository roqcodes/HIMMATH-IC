/** Shared Tailwind class strings for consistent UI (Tailwind-only styling). */

const easeSmooth = 'ease-[cubic-bezier(0.22,1,0.36,1)]';

/** 8px — buttons, fields, cards, tables, modals */
export const uiRadius = 'rounded-lg';

/** Default container / card elevation */
export const uiShadow = 'shadow-surface-xs';

/** Toolbars, filter bars, hover lift */
export const uiShadowRaised = 'shadow-surface';

/** Modals and dropdown panels */
export const uiShadowOverlay = 'shadow-dropdown';

/** Vertical rhythm between page sections */
export const sectionGap = 'mb-3';

/** Standard card / panel padding */
export const cardPad = 'p-3';

/** Toolbar / filter row gaps */
export const toolbarGap = 'gap-2';

const btnBase = `inline-flex h-8 max-md:h-9 items-center justify-center gap-1.5 px-3 text-sm font-semibold transition-[colors,box-shadow,border-color,transform] duration-200 ${uiRadius} disabled:pointer-events-none disabled:opacity-50`;

export const btnPrimary = `${btnBase} bg-slate-900 text-white ${uiShadow} hover:bg-slate-800 dark:bg-[var(--theme-surface-raised)] dark:hover:bg-[var(--theme-surface-hover)]`;

export const btnSecondary = `${btnBase} border border-[var(--theme-border-field)] bg-white text-slate-900 ${uiShadow} hover:border-[var(--theme-border-strong)] hover:shadow-surface dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text)]`;

export const btnGhost = `${btnBase} border-0 bg-transparent px-2.5 text-slate-500 hover:bg-black/[0.05] hover:text-slate-900 dark:text-[var(--theme-text-secondary)] dark:hover:bg-white/[0.06] dark:hover:text-[var(--theme-text)]`;

export const btnDangerOutline = `${btnBase} border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400`;

export const btnDangerSolid = `${btnBase} bg-red-600 text-white ${uiShadow} hover:bg-red-700`;

export const btnWarningSolid = `${btnBase} bg-amber-500 text-white ${uiShadow} hover:bg-amber-600`;

export const btnSuccessSolid = `${btnBase} bg-emerald-600 text-white ${uiShadow} hover:bg-emerald-700`;

export const btnSm = 'px-2.5 py-1 text-[11px] sm:text-xs';

export const pageHeader =
  `${sectionGap} flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3 sm:gap-y-2`;

export const pageTitle = 'text-base font-semibold tracking-tight text-slate-900 dark:text-[var(--theme-text)]';

export const pageSubtitle = 'mt-0.5 text-xs text-slate-500 dark:text-[var(--theme-text-secondary)]';

export const sectionEyebrow =
  'mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 sm:text-[11px] dark:text-[var(--theme-text-muted)]';

export const kpiCard =
  `relative overflow-hidden ${uiRadius} border border-[var(--theme-border-subtle)] bg-white ${cardPad} ${uiShadow} transition-[box-shadow,border-color] duration-300 ${easeSmooth} hover:border-[var(--theme-border)] hover:shadow-surface sm:p-4 dark:bg-[var(--theme-surface)]`;

export const surfaceCard =
  `overflow-hidden ${uiRadius} border border-[var(--theme-border-subtle)] bg-white ${uiShadow} dark:bg-[var(--theme-surface)]`;

export const kpiGrid =
  `${sectionGap} grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4`;

export const kpiGrid5 =
  `${sectionGap} grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5`;

export const chartGrid = `${sectionGap} grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4`;

export const chartArea = 'relative h-44 w-full min-h-[176px] sm:h-48 md:h-52';

export const tableWrap =
  '-mx-1 overflow-x-auto overscroll-x-contain px-1 [-webkit-overflow-scrolling:touch] sm:mx-0 sm:px-0';

export const dataTable = 'w-full min-w-[560px] border-collapse text-left text-sm';

export const formLabel =
  'mb-1 block text-[11px] font-medium leading-none text-slate-500 dark:text-[var(--theme-text-secondary)]';

export const formInput =
  `h-8 w-full ${uiRadius} border border-[var(--theme-border-field)] bg-white px-2.5 text-sm text-slate-900 shadow-[inset_0_1px_2px_rgb(15_23_42/0.04)] outline-none placeholder:text-slate-400 focus-visible:border-[var(--theme-accent)] focus-visible:ring-2 focus-visible:ring-[var(--theme-focus-ring)] max-md:h-9 dark:bg-[var(--theme-input-bg)] dark:text-[var(--theme-text)] dark:placeholder:text-[var(--theme-text-muted)] dark:shadow-[inset_0_1px_2px_rgb(0_0_0/0.2)]`;

export const formSelect = formInput;

export const formTextarea = `${formInput} min-h-[4rem] resize-y py-2 max-md:min-h-[4.5rem]`;

export const formGroup = 'min-w-0';

export const formRow = 'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-12 lg:items-end';

export const formHint = 'mt-0.5 text-[11px] text-slate-400 dark:text-[var(--theme-text-muted)]';

export const formError = 'mt-1 text-[13px] font-semibold text-red-600 dark:text-red-400';

export const filtersBar =
  `${sectionGap} flex flex-wrap items-center ${toolbarGap} ${uiRadius} border border-[var(--theme-border-subtle)] bg-white px-3 py-2 text-sm ${uiShadowRaised} dark:bg-[var(--theme-surface)]`;

export const filterChip =
  `inline-flex h-8 items-center justify-center ${uiRadius} border border-[var(--theme-border-field)] bg-white px-3 text-xs font-semibold text-slate-600 ${uiShadow} transition-[box-shadow,border-color,background-color] duration-200 hover:border-[var(--theme-border-strong)] hover:shadow-surface dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-raised)] dark:text-[var(--theme-text-secondary)]`;

export const filterChipActive =
  `inline-flex h-8 items-center justify-center ${uiRadius} border border-slate-900 bg-slate-900 px-3 text-xs font-semibold text-white ${uiShadow} dark:border-[var(--theme-border-strong)] dark:bg-[var(--theme-surface-hover)] dark:text-[var(--theme-text)]`;

export const filterSelect =
  `${uiRadius} border border-[var(--theme-border-field)] bg-white px-3 py-2 text-[13px] font-medium text-slate-900 shadow-[inset_0_1px_2px_rgb(15_23_42/0.04)] outline-none transition-[border-color,box-shadow] duration-200 hover:border-[var(--theme-border-strong)] focus:border-[var(--theme-accent)] focus:ring-2 focus:ring-[var(--theme-focus-ring)] sm:text-sm dark:bg-[var(--theme-input-bg)] dark:text-[var(--theme-text)] dark:shadow-[inset_0_1px_2px_rgb(0_0_0/0.2)]`;

export const tabsBar =
  `${sectionGap} flex gap-1 overflow-x-auto border-b border-[var(--theme-border-subtle)] pb-1.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-1.5 [&::-webkit-scrollbar]:hidden`;

export const tabBtn =
  `shrink-0 ${uiRadius} px-3 py-2 text-xs font-semibold text-slate-500 transition-colors duration-200 hover:bg-black/[0.04] hover:text-slate-900 dark:text-[var(--theme-text-secondary)] dark:hover:bg-white/[0.06] dark:hover:text-[var(--theme-text)] sm:text-sm`;

export const tabBtnActive =
  `shrink-0 ${uiRadius} border border-[var(--theme-border)] bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-900 ${uiShadow} dark:bg-[var(--theme-surface-raised)] dark:text-[var(--theme-text)] sm:text-sm`;

/** Icon-only header / toolbar control */
export const iconBtn =
  `flex size-9 shrink-0 items-center justify-center ${uiRadius} border border-[var(--theme-border-subtle)] bg-white text-slate-600 ${uiShadow} transition-colors hover:border-[var(--theme-border)] hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-accent)] dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text-secondary)]`;
