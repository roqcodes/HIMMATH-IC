'use client';

import React, { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import AsicToolbarShell from '@/components/asic/AsicToolbarShell';
import { useApp } from '@/context/AppContext';
import { isHqAdminStaff } from '@/lib/icFunds/hqBranch';
import { isICFundsSection, type ICFundsSectionId } from '@/lib/icFunds/nav';
import type { AsicSectionId } from '@/lib/asic/pages';

function fundSectionFromPath(pathname: string): ICFundsSectionId {
  const tail = pathname.split('/ic-funds/')[1];
  if (!tail) return 'payments';
  const first = tail.split('/').filter(Boolean)[0];
  return isICFundsSection(first) ? first : 'payments';
}

export default function ICFundsLegacyShell({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useApp();
  const fundSection = fundSectionFromPath(pathname);
  const asicSection = fundSection as AsicSectionId;

  const portal = useMemo(() => {
    if (user?.role === 'admin' || user?.role === 'auditor') return 'admin' as const;
    if (user && isHqAdminStaff(user)) return 'admin' as const;
    return 'branch' as const;
  }, [user]);

  const toolbarSlug = portal === 'admin' ? undefined : slug;

  return (
    <AsicToolbarShell portal={portal} slug={toolbarSlug} section={asicSection}>
      {children}
    </AsicToolbarShell>
  );
}
