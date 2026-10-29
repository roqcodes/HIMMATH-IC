'use client';

import React, { Suspense } from 'react';
import ASICAdminSidebar from '@/components/asic/ASICAdminSidebar';
import ASICToolbar from '@/components/asic/ASICToolbar';
import Topbar from '@/components/layout/Topbar';
import { adminShellContent, adminShellMain } from '@/components/layout/adminShell';
import type { AsicSectionId } from '@/lib/asic/pages';

type Props = {
  section: AsicSectionId;
  children: React.ReactNode;
  slug?: string;
};

/** HQ admin layout: sidebar + column header + content (matches ASICApp admin mode). */
export default function AdminAppShell({ section, children, slug }: Props) {
  const mobileSectionNav = (
    <div className="border-b border-slate-200/90 bg-white/95 px-2 py-1 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]/95">
      <ASICToolbar portal="admin" slug={slug} section={section} />
    </div>
  );

  return (
    <div className="flex min-h-0 w-full flex-1 md:min-h-[calc(100dvh)]">
      <Suspense fallback={null}>
        <ASICAdminSidebar section={section} slug={slug} />
      </Suspense>
      <div className={`flex min-w-0 flex-1 flex-col ${adminShellMain}`}>
        <div className="sticky top-0 z-40 hidden shrink-0 md:block">
          <Topbar variant="admin-column" />
        </div>
        <div className="md:hidden">{mobileSectionNav}</div>
        <div className={`min-w-0 flex-1 ${adminShellContent}`}>{children}</div>
      </div>
    </div>
  );
}
