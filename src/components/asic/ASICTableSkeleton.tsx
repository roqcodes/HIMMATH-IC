import React from 'react';
import { asicCard } from '@/components/asic/ui';
import { PRODUCT_NAME } from '@/lib/brand';

function Bar({ className }: { className: string }) {
  return <div className={`skeleton-bar ${className}`} />;
}

function TableRows({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div className="space-y-2 px-2.5 py-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Bar
              key={c}
              className={`h-2.5 ${
                c === 0 ? 'w-[22%] shrink-0' : c === cols - 1 ? 'ml-auto w-[12%] shrink-0' : 'min-w-0 flex-1'
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function PageHeaderBones() {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 space-y-2">
        <Bar className="h-4 w-32" />
        <Bar className="h-2.5 w-48 opacity-80" />
      </div>
      <Bar className="h-8 w-24 shrink-0" />
    </div>
  );
}

function ToolbarBones() {
  return (
    <div className="mb-3 flex flex-wrap gap-2" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <Bar key={i} className="h-7 w-14" />
      ))}
    </div>
  );
}

function FilterBones() {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      <Bar className="h-9 w-full max-w-md" />
      <Bar className="h-9 w-24" />
      <Bar className="h-9 w-24" />
    </div>
  );
}

function KpiBones({ count = 4 }: { count?: number }) {
  return (
    <div className={`${asicCard} mb-3 grid grid-cols-2 divide-x divide-y divide-[var(--theme-border-subtle)] sm:grid-cols-4 sm:divide-y-0`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2 px-3 py-3">
          <Bar className="h-2 w-16 opacity-70" />
          <Bar className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function ASICTableSkeleton({
  rows = 10,
  cols = 6,
  framed = true,
}: {
  rows?: number;
  cols?: number;
  framed?: boolean;
}) {
  const body = <TableRows rows={rows} cols={cols} />;
  if (!framed) {
    return (
      <div aria-busy="true" aria-label="Loading table">
        {body}
      </div>
    );
  }
  return (
    <div className={asicCard} aria-busy="true" aria-label="Loading table">
      <div className="border-b border-[var(--theme-border-subtle)] px-3 py-2.5">
        <Bar className="h-3 w-36" />
      </div>
      {body}
    </div>
  );
}

export function ASICFormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className={`${asicCard} space-y-4 p-4`} aria-busy="true" aria-label="Loading form">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Bar className="h-2 w-14 opacity-70" />
            <Bar className="h-8 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ASICKPISkeleton({ count = 4 }: { count?: number }) {
  return <KpiBones count={count} />;
}

/** Row placeholders that sit inside an existing `<tbody>`. */
export function ASICTableRowsSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-[var(--theme-border-subtle)]">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-2.5 py-2.5">
              <Bar
                className={`h-2.5 ${
                  c === 0 ? 'w-24' : c === cols - 1 ? 'ml-auto w-16' : 'w-full max-w-[7.5rem]'
                }`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function ASICPageSkeleton({
  variant = 'list',
  rows = 10,
  cols = 6,
}: {
  variant?: 'list' | 'dashboard' | 'detail' | 'form' | 'portal';
  rows?: number;
  cols?: number;
}) {
  if (variant === 'form') {
    return (
      <div aria-busy="true" aria-label="Loading page">
        <PageHeaderBones />
        <ASICFormSkeleton />
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading dashboard">
        <PageHeaderBones />
        <KpiBones count={4} />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className={`${asicCard} p-4`}>
            <Bar className="mb-3 h-3 w-28" />
            <Bar className="h-40 w-full" />
          </div>
          <div className={`${asicCard} p-4`}>
            <Bar className="mb-3 h-3 w-28" />
            <Bar className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading details">
        <PageHeaderBones />
        <KpiBones count={4} />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Bar key={i} className="h-7 w-16" />
          ))}
        </div>
        <ASICTableSkeleton rows={rows} cols={cols} />
      </div>
    );
  }

  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading page">
      {variant === 'portal' ? <ToolbarBones /> : null}
      <PageHeaderBones />
      <KpiBones count={4} />
      <FilterBones />
      <ASICTableSkeleton rows={rows} cols={cols} />
    </div>
  );
}

export function ASICAppShellSkeleton({ asic = false }: { asic?: boolean }) {
  return (
    <div className="flex min-h-dvh bg-[var(--theme-canvas)]" aria-busy="true" aria-label={`Loading ${PRODUCT_NAME}`}>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-50 flex items-center gap-3 border-b border-[var(--theme-border-subtle)] bg-[var(--theme-surface)] px-4 py-3 sm:px-6">
          <Bar className="h-9 max-w-xl flex-1 rounded-lg" />
          <Bar className="h-9 w-9 shrink-0 rounded-lg" />
          <Bar className="h-9 w-20 shrink-0 rounded-lg" />
        </div>
        <main
          className={
            asic
              ? 'flex-1 px-2 py-1 sm:px-3'
              : 'mx-auto w-full max-w-[1680px] flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7'
          }
        >
          <ASICPageSkeleton variant={asic ? 'portal' : 'list'} />
        </main>
      </div>
    </div>
  );
}
