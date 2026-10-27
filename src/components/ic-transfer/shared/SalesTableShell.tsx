'use client';

import React from 'react';
import AsicTabBar, { AsicTabButton } from '@/components/asic/AsicTabBar';

export { AsicTabButton, TabCountBadge } from '@/components/asic/AsicTabBar';

export const salesTableShellClass =
  'overflow-hidden rounded-lg border border-[var(--theme-border-subtle)] bg-white shadow-surface-xs dark:bg-[var(--theme-surface)]';

export const salesTableToolbarClass =
  'flex flex-col gap-2 border-b border-[var(--theme-border-subtle)] px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center';

export const salesTableSearchClass =
  'h-9 w-full min-w-0 flex-1 rounded-md border border-[var(--theme-border-field)] bg-white px-2.5 text-sm text-slate-800 shadow-[inset_0_1px_2px_rgb(15_23_42/0.04)] outline-none placeholder:text-slate-400 focus:border-[var(--theme-accent)] focus:ring-2 focus:ring-[var(--theme-focus-ring)] sm:h-8 sm:min-w-[160px] dark:bg-[var(--theme-input-bg)] dark:text-[var(--theme-text)] dark:shadow-[inset_0_1px_2px_rgb(0_0_0/0.2)]';

export const salesTableSelectClass =
  'h-8 shrink-0 rounded-md border border-[var(--theme-border-field)] bg-white px-2 text-xs text-slate-700 shadow-[inset_0_1px_2px_rgb(15_23_42/0.04)] dark:bg-[var(--theme-input-bg)] dark:text-[var(--theme-text)] dark:shadow-[inset_0_1px_2px_rgb(0_0_0/0.2)]';

export const salesTableClass = 'w-full border-collapse text-left text-sm';

export const salesTableTheadRowClass = 'border-b border-slate-200 bg-slate-50/80';

export const salesTableThClass =
  'px-2.5 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-500';

export const salesTableThSortableClass = `${salesTableThClass} cursor-pointer select-none hover:text-slate-800`;

export const salesTableTdClass = 'px-2.5 py-2.5 text-sm text-slate-800';

export const salesTableTdLabelClass = 'px-2.5 py-2.5 text-sm font-medium text-slate-900';

export const salesTableRowClass =
  'border-b border-[var(--theme-border-subtle)] transition-colors hover:bg-slate-50/80 dark:hover:bg-[var(--theme-surface-hover)]';

export const salesTableRowInteractiveClass = `${salesTableRowClass} cursor-pointer`;

export const salesTableEmptyClass = 'px-3 py-10 text-center text-sm text-slate-400';

type TabItem = {
  id: string;
  label: string;
  count?: number;
};

type Props = {
  title?: string;
  tabs?: TabItem[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  toolbarEnd?: React.ReactNode;
  children: React.ReactNode;
  mobileContent?: React.ReactNode;
};

export function SalesTableTab({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <AsicTabButton active={active} label={label} count={count} onClick={onClick} />
  );
}

export default function SalesTableShell({
  title,
  tabs,
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters,
  toolbarEnd,
  children,
  mobileContent,
}: Props) {
  const showToolbar = title || search !== undefined || filters || toolbarEnd;

  return (
    <div className={salesTableShellClass}>
      {tabs && tabs.length > 0 ? (
        <AsicTabBar tabs={tabs} activeTab={activeTab ?? ''} onTabChange={id => onTabChange?.(id)} />
      ) : null}

      {showToolbar ? (
        <div className={salesTableToolbarClass}>
          {title ? <h3 className="shrink-0 text-sm font-medium text-slate-900">{title}</h3> : null}
          <div className="flex w-full flex-col gap-2 sm:flex-1 sm:flex-row sm:flex-wrap sm:items-center">
            {search !== undefined && onSearchChange ? (
              <input
                type="search"
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className={salesTableSearchClass}
              />
            ) : null}
            {filters ? (
              <div className="flex flex-wrap items-center gap-2 max-sm:w-full [&_select]:h-9 [&_select]:w-full [&_select]:sm:h-8 [&_select]:sm:w-auto">
                {filters}
              </div>
            ) : null}
            {toolbarEnd ? (
              <div className="flex shrink-0 items-center gap-2 sm:ml-auto max-sm:w-full max-sm:[&>button]:flex-1">
                {toolbarEnd}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {mobileContent ? (
        <>
          <div className="hidden overflow-x-auto md:block">{children}</div>
          <div className="md:hidden">{mobileContent}</div>
        </>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </div>
  );
}
