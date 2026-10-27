'use client';

import React from 'react';
import { asicCard } from '@/components/asic/ui';

type Props = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
};

export default function DetailSection({ title, description, action, children, id }: Props) {
  return (
    <section className={asicCard} id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--theme-border-subtle)] px-3 py-2.5">
        <div className="min-w-0">
          <h2
            id={id ? `${id}-title` : undefined}
            className="text-sm font-semibold text-slate-900 dark:text-[var(--theme-text)]"
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-[var(--theme-text-secondary)]">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}
