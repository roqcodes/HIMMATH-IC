'use client';

import React, { Suspense } from 'react';
import type { AsicPortal } from '@/lib/asic/routing';
import type { AsicSectionId } from '@/lib/asic/pages';
import { canReadSection } from '@/lib/asic/pages';
import ASICToolbar from '@/components/asic/ASICToolbar';
import ASICAdminSidebar from '@/components/asic/ASICAdminSidebar';
import ASICSectionRouter from '@/components/asic/ASICSectionRouter';
import Topbar from '@/components/layout/Topbar';
import { adminShellContent, adminShellMain } from '@/components/layout/adminShell';
import { useApp } from '@/context/AppContext';

export default function ASICApp({
  portal,
  section,
  slug,
}: {
  portal: AsicPortal;
  section: AsicSectionId;
  slug?: string;
}) {
  const { user, currentSlug, isInitialLoading } = useApp();
  const branchSlug = slug ?? currentSlug;
  const isAdmin = portal === 'admin';
  const toolbarSlug = isAdmin ? undefined : branchSlug;

  if (
    !isInitialLoading &&
    portal !== 'admin' &&
    (!branchSlug || branchSlug === 'superadmin')
  ) {
    return <p className="text-sm text-slate-500">Select a branch workspace.</p>;
  }

  if (!isInitialLoading && !canReadSection(user, section, portal)) {
    return <p className="text-sm text-slate-500">You do not have access to this section.</p>;
  }

  const mobileSectionNav = (
    <div className="border-b border-slate-200/90 bg-white/95 px-2 py-1 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]/95">
      <ASICToolbar portal={portal} slug={toolbarSlug} section={section} />
    </div>
  );

  const desktopSectionNav = !isAdmin ? (
    <div className="sticky top-14 z-40 border-b border-slate-200/80 bg-white/95 px-1 pb-1 backdrop-blur-sm sm:px-2 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]/95">
      <ASICToolbar portal={portal} slug={toolbarSlug} section={section} />
    </div>
  ) : null;

  if (isAdmin) {
    return (
      <div className="flex min-h-0 w-full flex-1 md:min-h-[calc(100dvh)]">
        <Suspense fallback={null}>
          <ASICAdminSidebar section={section} slug={toolbarSlug} />
        </Suspense>
        <div className={`flex min-w-0 flex-1 flex-col ${adminShellMain}`}>
          <div className="sticky top-0 z-40 hidden shrink-0 md:block">
            <Topbar variant="admin-column" />
          </div>
          <div className="md:hidden">{mobileSectionNav}</div>
          <div className={`min-w-0 flex-1 ${adminShellContent}`}>
            <ASICSectionRouter portal={portal} section={section} slug={branchSlug} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="md:hidden">{mobileSectionNav}</div>
      {desktopSectionNav}
      <div className="min-w-0 flex-1 px-1 py-1 sm:px-2 sm:py-2">
        <ASICSectionRouter portal={portal} section={section} slug={branchSlug} />
      </div>
    </div>
  );
}
