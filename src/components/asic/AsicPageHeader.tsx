'use client';

import React from 'react';
import Link from 'next/link';
import ReadOnlyPill from '@/components/rbac/ReadOnlyPill';
import WriteGate from '@/components/rbac/WriteGate';

export type AsicBreadcrumbItem = {
  label: string;
  href?: string;
};

type Props = {
  title?: string;
  breadcrumbs?: AsicBreadcrumbItem[];
  subtitle?: string;
  /** Right-aligned controls that stay enabled in read-only mode (e.g. print, export). */
  toolbar?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
};

export default function AsicPageHeader({ title, breadcrumbs, subtitle, toolbar, actions, meta }: Props) {
  const trail =
    breadcrumbs && breadcrumbs.length > 0
      ? breadcrumbs
      : title
        ? [{ label: title }]
        : [];

  const currentLabel = trail[trail.length - 1]?.label ?? '';

  return (
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3 sm:gap-y-2">
      <div className="min-w-0">
        {trail.length > 1 ? (
          <nav aria-label="Breadcrumb" className="mb-1">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {trail.map((item, index) => {
                const isLast = index === trail.length - 1;
                return (
                  <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">
                    {index > 0 ? (
                      <span
                        className="select-none text-sm font-normal text-slate-300 dark:text-[var(--theme-text-muted)]"
                        aria-hidden
                      >
                        /
                      </span>
                    ) : null}
                    {isLast ? (
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate text-lg font-semibold tracking-tight text-slate-900 sm:text-xl dark:text-[var(--theme-text)]">
                          {item.label}
                        </span>
                        <ReadOnlyPill />
                        {meta}
                      </span>
                    ) : item.href ? (
                      <Link
                        href={item.href}
                        className="text-sm font-medium text-slate-500 no-underline transition-colors hover:text-accent dark:text-[var(--theme-text-secondary)]"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-slate-500 dark:text-[var(--theme-text-secondary)]">
                        {item.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl dark:text-[var(--theme-text)]">
              {currentLabel}
            </h1>
            <ReadOnlyPill />
            {meta}
          </div>
        )}
        {subtitle ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-[var(--theme-text-secondary)]">{subtitle}</p>
        ) : null}
      </div>
      {toolbar || actions ? (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          {toolbar ? (
            <div className="flex flex-1 flex-wrap items-center gap-2 sm:flex-none [&>button]:flex-1 sm:[&>button]:flex-none">
              {toolbar}
            </div>
          ) : null}
          {actions ? (
            <WriteGate className="flex flex-wrap items-center gap-2 [&>button]:flex-1 sm:[&>button]:flex-none [&>div]:w-full sm:[&>div]:w-auto">
              {actions}
            </WriteGate>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
