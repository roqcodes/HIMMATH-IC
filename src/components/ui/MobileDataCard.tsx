'use client';

import React from 'react';
import { portalMobileCardListClass } from '@/lib/icTransfer/layoutConstants';

export const mobileCardClass =
  'flex flex-col gap-2.5 rounded-lg border border-[var(--theme-border-subtle)] bg-white p-3 shadow-surface-xs dark:bg-[var(--theme-surface)]';

export const mobileCardInteractiveClass = `${mobileCardClass} cursor-pointer transition-colors hover:bg-slate-50 active:bg-slate-100`;

export const mobileCardFieldClass = 'flex items-start justify-between gap-3 text-sm';

export const mobileCardLabelClass = 'shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-400';

export const mobileCardValueClass = 'min-w-0 text-right font-medium text-slate-900';

export function MobileCardList({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`${portalMobileCardListClass} ${className}`.trim()}>{children}</div>;
}

export function MobileCardField({
  label,
  children,
  align = 'right',
}: {
  label: string;
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <div className={mobileCardFieldClass}>
      <span className={mobileCardLabelClass}>{label}</span>
      <span className={`min-w-0 ${align === 'right' ? mobileCardValueClass : 'text-slate-700'}`}>
        {children}
      </span>
    </div>
  );
}

export function MobileCardActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-2.5">
      {children}
    </div>
  );
}

export function MobileEmptyState({ children }: { children: React.ReactNode }) {
  return <div className="py-8 text-center text-sm text-slate-400">{children}</div>;
}

export function MobileCardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <MobileCardList>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-100 dark:bg-[var(--theme-surface-muted)]" />
      ))}
    </MobileCardList>
  );
}
