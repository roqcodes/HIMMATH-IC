'use client';

import React from 'react';
import ReadOnlyPill from '@/components/rbac/ReadOnlyPill';
import WriteGate from '@/components/rbac/WriteGate';
import { asicPageTitle } from '@/components/asic/ui';

type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
};

export default function AsicPageHeader({ title, subtitle, actions, meta }: Props) {
  return (
    <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3 sm:gap-y-2">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className={asicPageTitle}>{title}</h1>
          <ReadOnlyPill />
          {meta}
        </div>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? (
        <WriteGate className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:ml-auto sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none [&>div]:w-full sm:[&>div]:w-auto">
          {actions}
        </WriteGate>
      ) : null}
    </div>
  );
}
