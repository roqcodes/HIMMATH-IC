'use client';
import React from 'react';
import { useApp } from '@/context/AppContext';
import LoginPage from '@/components/auth/LoginPage';
import Topbar from '@/components/layout/Topbar';
import PortalSubNav from '@/components/layout/PortalSubNav';
import BranchPageGuard from '@/components/layout/BranchPageGuard';
import { RbacWriteProvider } from '@/context/RbacWriteContext';
import { usePathname } from 'next/navigation';
import { getSessionSlugFromPath, isAdminAsicPath, isAsicPortalPath } from '@/lib/asic/routing';
import { ASICAppShellSkeleton } from '@/components/asic/ASICTableSkeleton';
import { DealInvoiceProvider } from '@/components/ic-transfer/invoice/DealInvoiceContext';
import OfflineBanner from '@/components/layout/OfflineBanner';
import { ToastStack } from '@/components/layout/ToastStack';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialLoading, toasts } = useApp();
  const pathname = usePathname();
  const asic = isAsicPortalPath(pathname);
  const adminAsic = isAdminAsicPath(pathname);

  if (!isInitialLoading && !isAuthenticated) {
    const slug = getSessionSlugFromPath(pathname);
    return <LoginPage branchSlug={slug} />;
  }

  const mainClass = adminAsic
    ? 'flex min-h-0 w-full flex-1 flex-col p-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]'
    : asic
      ? 'flex min-h-0 w-full flex-1 flex-col px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-3 sm:py-2'
      : 'mx-auto w-full max-w-[1680px] flex-1 px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8 lg:py-7';

  return (
    <RbacWriteProvider>
    <DealInvoiceProvider>
      <div className="flex min-h-dvh bg-slate-50/50 dark:bg-[var(--theme-canvas)]">
        <BranchPageGuard />
        <div className="flex min-w-0 flex-1 flex-col">
          <OfflineBanner />
          <div className={`sticky top-0 z-50 shrink-0 ${adminAsic ? 'md:hidden' : ''}`}>
            <Topbar />
            {!asic && <PortalSubNav />}
          </div>
          <main className={`relative ${mainClass}`}>
            {children}
            {isInitialLoading ? (
              <div
                className="absolute inset-0 z-[80] overflow-auto bg-slate-50/95 backdrop-blur-sm dark:bg-[var(--theme-canvas)]/95"
                aria-busy="true"
                aria-label="Loading application"
              >
                <ASICAppShellSkeleton asic={asic} />
              </div>
            ) : null}
          </main>
        </div>
        <ToastStack toasts={toasts} />
      </div>
    </DealInvoiceProvider>
    </RbacWriteProvider>
  );
}
