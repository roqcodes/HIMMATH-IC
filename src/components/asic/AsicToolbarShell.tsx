'use client';

import React from 'react';
import ASICToolbar from '@/components/asic/ASICToolbar';
import type { AsicPortal } from '@/lib/asic/routing';
import type { AsicSectionId } from '@/lib/asic/pages';

export default function AsicToolbarShell({
  portal,
  slug,
  section,
  children,
}: {
  portal: AsicPortal;
  slug?: string;
  section: AsicSectionId;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-14 z-40 -mx-1 border-b border-slate-200/80 bg-white/95 px-1 pb-1 backdrop-blur-sm sm:-mx-2 sm:px-2 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]/95">
        <ASICToolbar portal={portal} slug={slug} section={section} />
      </div>
      <div className="min-w-0 flex-1 px-1 py-1 sm:px-2 sm:py-2">{children}</div>
    </div>
  );
}
