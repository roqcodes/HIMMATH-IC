/** Shared admin app shell surfaces — sidebar + main column header. */

export const adminShellHeader =
  'relative z-10 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200/90 bg-white/95 px-4 backdrop-blur-sm sm:px-5 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]/95';

export const adminShellMain =
  'min-w-0 flex-1 bg-slate-50/80 dark:bg-[var(--theme-canvas)]';

export const adminShellContent = 'px-3 py-3 sm:px-5 sm:py-4';

export const adminShellSidebar =
  'admin-sidebar-shell sticky top-0 z-30 hidden h-dvh shrink-0 flex-col overflow-hidden border-r border-slate-200/90 bg-gradient-to-b from-slate-50 via-slate-50/95 to-white md:flex dark:border-[var(--theme-border)] dark:from-[var(--theme-surface-muted)] dark:via-[var(--theme-surface)] dark:to-[var(--theme-surface)]';
