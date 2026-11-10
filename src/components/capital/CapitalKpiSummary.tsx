'use client';

import React from 'react';
import { icfCard } from '@/components/ic-funds/ui';
import { AsicKpiMetricCell, type AsicKpiMetric } from '@/components/asic/AsicKpiStrip';

type Group = {
  id: string;
  title: string;
  metrics: AsicKpiMetric[];
  /** Grid columns at lg; defaults from metric count. */
  lgCols?: 2 | 3 | 4;
};

function groupColClass(lgCols: number) {
  if (lgCols === 4) return 'sm:grid-cols-2 lg:grid-cols-4';
  if (lgCols === 3) return 'sm:grid-cols-3';
  return 'sm:grid-cols-2';
}

function GroupBlock({ group, isFirst }: { group: Group; isFirst: boolean }) {
  const lgCols = group.lgCols ?? (group.metrics.length >= 4 ? 4 : group.metrics.length === 3 ? 3 : 2);
  return (
    <div
      className={
        isFirst
          ? 'min-w-0'
          : 'min-w-0 border-t border-[var(--theme-border-subtle)]'
      }
    >
      <div className="flex items-center gap-2 px-3 pb-0 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-[var(--theme-text-muted)]">
          {group.title}
        </p>
        <div
          className="h-px min-w-0 flex-1 bg-[var(--theme-border-subtle)]"
          aria-hidden
        />
      </div>
      <div
        className={`grid grid-cols-2 divide-x divide-y divide-[var(--theme-border-subtle)] ${groupColClass(lgCols)}`}
      >
        {group.metrics.map(m => (
          <div key={m.label} className="min-w-0 bg-[var(--theme-surface)]">
            <AsicKpiMetricCell {...m} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CapitalKpiSummary({ groups }: { groups: Group[] }) {
  return (
    <section className={`relative isolate z-0 mb-3 ${icfCard}`} aria-label="Summary metrics">
      {groups.map((g, i) => (
        <GroupBlock key={g.id} group={g} isFirst={i === 0} />
      ))}
    </section>
  );
}
