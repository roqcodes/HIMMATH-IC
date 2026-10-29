'use client';

import React from 'react';
import { useParams, usePathname } from 'next/navigation';
import AdminAppShell from '@/components/asic/AdminAppShell';
import ASICToolbar from '@/components/asic/ASICToolbar';
import { resolveSectionFromPathname } from '@/lib/asic/access';
import { canReadSection, type AsicSectionId } from '@/lib/asic/pages';
import type { AsicPortal } from '@/lib/asic/routing';
import { useApp } from '@/context/AppContext';

function PortalAccessGate({
  portal,
  section,
  slug,
  children,
}: {
  portal: AsicPortal;
  section: AsicSectionId;
  slug?: string;
  children: React.ReactNode;
}) {
  const { user, isInitialLoading } = useApp();

  if (
    !isInitialLoading &&
    portal !== 'admin' &&
    (!slug || slug === 'superadmin')
  ) {
    return <p className="text-sm text-slate-500">Select a branch workspace.</p>;
  }

  if (!isInitialLoading && !canReadSection(user, section, portal)) {
    return <p className="text-sm text-slate-500">You do not have access to this section.</p>;
  }

  return children;
}

function BranchPortalChrome({
  portal,
  section,
  slug,
  children,
}: {
  portal: Exclude<AsicPortal, 'admin'>;
  section: AsicSectionId;
  slug?: string;
  children: React.ReactNode;
}) {
  const mobileSectionNav = (
    <div className="border-b border-slate-200/90 bg-white/95 px-2 py-1 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]/95">
      <ASICToolbar portal={portal} slug={slug} section={section} />
    </div>
  );

  const desktopSectionNav = (
    <div className="sticky top-14 z-40 border-b border-slate-200/80 bg-white/95 px-1 pb-1 backdrop-blur-sm sm:px-2 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]/95">
      <ASICToolbar portal={portal} slug={slug} section={section} />
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="md:hidden">{mobileSectionNav}</div>
      {desktopSectionNav}
      <div className="min-w-0 flex-1 px-1 py-1 sm:px-2 sm:py-2">{children}</div>
    </div>
  );
}

export function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const scope = resolveSectionFromPathname(pathname);
  const section = scope?.section ?? 'dashboard';

  return (
    <PortalAccessGate portal="admin" section={section}>
      <AdminAppShell section={section}>{children}</AdminAppShell>
    </PortalAccessGate>
  );
}

export function SlugPortalLayout({
  portal,
  children,
}: {
  portal: Exclude<AsicPortal, 'admin'>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();
  const slug = typeof params.slug === 'string' ? params.slug : undefined;
  const scope = resolveSectionFromPathname(pathname);
  const section = scope?.section ?? 'dashboard';

  return (
    <PortalAccessGate portal={portal} section={section} slug={slug}>
      <BranchPortalChrome portal={portal} section={section} slug={slug}>
        {children}
      </BranchPortalChrome>
    </PortalAccessGate>
  );
}
