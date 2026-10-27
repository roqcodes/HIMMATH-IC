'use client';

import React from 'react';
import type { AsicPortal } from '@/lib/asic/routing';
import type { AsicSectionId } from '@/lib/asic/pages';
import { canReadSection } from '@/lib/asic/pages';
import ASICToolbar from '@/components/asic/ASICToolbar';
import ASICSectionRouter from '@/components/asic/ASICSectionRouter';
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

  if (
    !isInitialLoading &&
    portal !== 'admin' &&
    (!branchSlug || branchSlug === 'superadmin')
  ) {
    return <p className="text-sm text-slate-500">Select a branch workspace.</p>;
  }

  // Server pages already enforce auth via requirePortalUser; defer client RBAC until bootstrap
  // finishes so the hydrated tree matches SSR (avoids React #310 hook mismatch).
  if (!isInitialLoading && !canReadSection(user, section, portal)) {
    return <p className="text-sm text-slate-500">You do not have access to this section.</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-14 z-40 -mx-1 border-b border-slate-200/80 bg-white/95 px-1 pb-1 backdrop-blur-sm sm:-mx-2 sm:px-2 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]/95">
        <ASICToolbar
          portal={portal}
          slug={portal === 'admin' ? undefined : branchSlug}
          section={section}
        />
      </div>
      <div className="min-w-0 flex-1 px-1 py-1 sm:px-2 sm:py-2">
        <ASICSectionRouter portal={portal} section={section} slug={branchSlug} />
      </div>
    </div>
  );
}
