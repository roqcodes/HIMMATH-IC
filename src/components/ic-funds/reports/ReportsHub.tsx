'use client';

import Link from 'next/link';
import {
  REPORT_HUB_COLUMNS,
  reportCatalogGroup,
} from '@/lib/icFunds/reportCatalog';
import { icFundsReportPath } from '@/lib/icFunds/nav';
import { icfCard } from '@/components/ic-funds/ui';

function ReportGroupBlock({
  slug,
  portal,
  groupId,
}: {
  slug: string;
  portal: 'admin' | 'branch';
  groupId: (typeof REPORT_HUB_COLUMNS)[number]['groupIds'][number];
}) {
  const group = reportCatalogGroup(groupId);
  if (!group) return null;

  return (
    <section className={icfCard}>
      <div className="border-b border-slate-200 px-3 py-2 dark:border-[var(--theme-border)]">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[var(--theme-text-muted)]">
          {group.title}
        </h3>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-[var(--theme-text-secondary)]">
          {group.description}
        </p>
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-[var(--theme-border-subtle)]">
        {group.reports.map(report => (
          <li key={report.id}>
            <Link
              href={icFundsReportPath(slug, report.id, portal)}
              className="block px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-[var(--theme-surface-muted)]"
            >
              <span className="text-sm font-medium text-slate-900 dark:text-[var(--theme-text)]">
                {report.title}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-[var(--theme-text-secondary)]">
                {report.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ReportsHub({
  slug,
  portal = 'admin',
}: {
  slug: string;
  portal?: 'admin' | 'branch';
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-0 md:divide-x md:divide-slate-200 dark:md:divide-[var(--theme-border)]">
      {REPORT_HUB_COLUMNS.map(column => (
        <div key={column.id} className="min-w-0 space-y-3 md:px-4 md:first:pl-0 md:last:pr-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-[var(--theme-text-muted)]">
            {column.heading}
          </p>
          {column.groupIds.map(groupId => (
            <ReportGroupBlock key={groupId} slug={slug} portal={portal} groupId={groupId} />
          ))}
        </div>
      ))}
    </div>
  );
}
