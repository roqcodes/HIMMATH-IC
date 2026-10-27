'use client';

import React, { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import AsicToolbarShell from '@/components/asic/AsicToolbarShell';
import { useApp } from '@/context/AppContext';
import { isHqAdminStaff } from '@/lib/icFunds/hqBranch';
import { parseAsicPath } from '@/lib/asic/routing';

function resolveCustomerDetailToolbar(pathname: string, isHqStaff: boolean) {
  const parsed = parseAsicPath(pathname);

  if (parsed.portal === 'branch' && parsed.branchSlug) {
    return { portal: 'branch' as const, slug: parsed.branchSlug };
  }

  if (parsed.portal === 'legacy' && parsed.branchSlug) {
    if (isHqStaff) {
      return { portal: 'admin' as const, slug: undefined };
    }
    return { portal: 'branch' as const, slug: parsed.branchSlug };
  }

  if (parsed.portal === 'admin-root') {
    return { portal: 'admin' as const, slug: undefined };
  }

  return { portal: 'branch' as const, slug: parsed.branchSlug ?? undefined };
}

export default function CustomerDetailShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useApp();
  const isHqStaff = user?.role === 'admin' || user?.role === 'auditor' || Boolean(user && isHqAdminStaff(user));

  const toolbar = useMemo(
    () => resolveCustomerDetailToolbar(pathname, isHqStaff),
    [pathname, isHqStaff],
  );

  return (
    <AsicToolbarShell portal={toolbar.portal} slug={toolbar.slug} section="accounts">
      {children}
    </AsicToolbarShell>
  );
}
