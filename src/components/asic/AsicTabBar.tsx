'use client';

import React from 'react';

export type AsicTabItem = {
  id: string;
  label: string;
  count?: number;
};

export function TabCountBadge({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className={`ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-md px-1.5 py-px text-[10px] font-bold tabular-nums ${
        active
          ? 'bg-slate-900 text-white dark:bg-[var(--theme-surface-raised)] dark:text-[var(--theme-text)]'
          : count > 0
            ? 'bg-slate-200 text-slate-700 dark:bg-[var(--theme-surface-muted)] dark:text-[var(--theme-text-secondary)]'
            : 'bg-slate-100 text-slate-400 dark:bg-[var(--theme-surface-muted)] dark:text-[var(--theme-text-muted)]'
      }`}
    >
      {count}
    </span>
  );
}

export function AsicTabButton({
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
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative flex shrink-0 items-center px-3 py-2.5 text-xs font-medium transition-colors ${
        active
          ? 'text-slate-900 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-slate-900 dark:text-[var(--theme-text)] dark:after:bg-[var(--theme-text)]'
          : 'text-slate-500 hover:text-slate-800 dark:text-[var(--theme-text-secondary)] dark:hover:text-[var(--theme-text)]'
      }`}
    >
      {label}
      {count != null ? <TabCountBadge count={count} active={active} /> : null}
    </button>
  );
}

export default function AsicTabBar({
  tabs,
  activeTab,
  onTabChange,
  className = '',
  ariaLabel = 'Sections',
}: {
  tabs: AsicTabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  if (tabs.length === 0) return null;

  return (
    <div
      className={`flex gap-0 overflow-x-auto border-b border-slate-200 px-1 scrollbar-none dark:border-[var(--theme-border)] ${className}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map(tab => (
        <AsicTabButton
          key={tab.id}
          active={activeTab === tab.id}
          label={tab.label}
          count={tab.count}
          onClick={() => onTabChange(tab.id)}
        />
      ))}
    </div>
  );
}
