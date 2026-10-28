'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { IC_TRANSFER_NAV, IC_TRANSFER_BRANCH_PORTAL_NAV } from '@/lib/icTransfer/nav';
import { getBranchPortalDisplayName } from '@/lib/icTransfer/branchPortalScope';
import { WAREHOUSE_NAV } from '@/lib/warehouse/nav';
import MobileDrawer from '@/components/ui/MobileDrawer';
import { MobileMenuButton, MobileNavLinkList } from '@/components/layout/MobileNav';

type NavLink = {
  id: string;
  label: string;
  href: string;
};

function resolveICTransferBranchBase(currentSlug: string): string {
  return currentSlug === 'superadmin' ? '/admin/sales' : `/branch/${currentSlug}/orders`;
}

function isICTransferBranchActive(pathname: string, href: string): boolean {
  const normalizedPath = pathname.replace(/\/$/, '');
  const normalizedHref = href.replace(/\/$/, '');

  if (normalizedHref.endsWith('/ic-transfer') || normalizedHref === '/ic-transfer') {
    return normalizedPath === normalizedHref;
  }

  return normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`);
}

function resolveICTransferAdminBase(currentSlug: string): string {
  return currentSlug === 'superadmin' ? '/admin/sales' : `/branch/${currentSlug}/sales`;
}

function resolveWarehouseBase(currentSlug: string): string {
  return currentSlug === 'superadmin' ? '/admin/warehouse' : `/warehouse/${currentSlug}/orders`;
}

function isICTransferAdminActive(pathname: string, href: string): boolean {
  const normalizedPath = pathname.replace(/\/$/, '');
  const normalizedHref = href.replace(/\/$/, '');

  if (normalizedHref.endsWith('/ic-transfer-admin') || normalizedHref === '/ic-transfer-admin') {
    return normalizedPath === normalizedHref;
  }

  return normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`);
}

function isWarehouseActive(pathname: string, href: string): boolean {
  const normalizedPath = pathname.replace(/\/$/, '');
  const normalizedHref = href.replace(/\/$/, '');

  if (normalizedHref.endsWith('/warehouse') || normalizedHref === '/warehouse') {
    return normalizedPath === normalizedHref;
  }

  return normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`);
}

type SubNavVariant = 'default' | 'centered';

const defaultTabClass = (active: boolean) =>
  `whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold no-underline transition-colors sm:px-3.5 sm:text-[13px] ${
    active
      ? 'bg-slate-900 text-white shadow-sm dark:bg-[var(--theme-surface-hover)] dark:text-[var(--theme-text)] dark:shadow-none dark:ring-1 dark:ring-[var(--theme-border-strong)]'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-[var(--theme-text-secondary)] dark:hover:bg-[var(--theme-surface-hover)] dark:hover:text-[var(--theme-text)]'
  }`;

const centeredTabClass = (active: boolean) =>
  `whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold no-underline transition-all duration-200 sm:px-4 sm:text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-[var(--theme-canvas)] ${
    active
      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/70 dark:bg-[var(--theme-surface-hover)] dark:text-[var(--theme-text)] dark:ring-[var(--theme-border-strong)]'
      : 'text-slate-500 hover:text-slate-800 dark:text-[var(--theme-text-secondary)] dark:hover:text-[var(--theme-text)]'
  }`;

const subNavShell =
  'border-b border-slate-200/80 bg-white/95 backdrop-blur-xl dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]/95';

type SubNavBarProps = {
  label: string;
  sublabel?: string;
  links: NavLink[];
  isActive: (pathname: string, href: string) => boolean;
  variant?: SubNavVariant;
};

function MobileSubNav({
  label,
  sublabel,
  links,
  isActive,
}: {
  label: string;
  sublabel?: string;
  links: NavLink[];
  isActive: (pathname: string, href: string) => boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const activeLink = links.find(link => isActive(pathname, link.href));

  return (
    <div className={`flex items-center gap-2 px-4 py-2 md:hidden ${subNavShell}`}>
      <MobileMenuButton onClick={() => setOpen(true)} activeSection={label} />
      <div className="min-w-0 flex-1 text-right">
        <p className="truncate text-xs font-semibold text-slate-800">{activeLink?.label ?? label}</p>
        {sublabel ? (
          <p className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-400">{sublabel}</p>
        ) : null}
      </div>
      <MobileDrawer
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        subtitle={sublabel}
      >
        <MobileNavLinkList
          groups={[{ id: 'main', items: links }]}
          activeId={activeLink?.id}
          onNavigate={() => setOpen(false)}
        />
      </MobileDrawer>
    </div>
  );
}

function SubNavBar({ label, sublabel, links, isActive, variant = 'default' }: SubNavBarProps) {
  const pathname = usePathname();

  const labelBlock = sublabel ? (
    <div className="hidden shrink-0 sm:block">
      <p className="text-[13px] font-bold leading-tight text-slate-800">{label}</p>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{sublabel}</p>
    </div>
  ) : (
    <p className="hidden shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 sm:block">
      {label}
    </p>
  );

  if (variant === 'centered') {
    return (
      <>
        <MobileSubNav label={label} sublabel={sublabel} links={links} isActive={isActive} />
        <nav
          className={`hidden md:block ${subNavShell}`}
          aria-label={`${label} navigation`}
        >
          <div className="mx-auto flex max-w-[1680px] justify-center px-4 py-2.5 sm:px-6 lg:px-8">
            <div className="flex min-w-0 flex-col items-center gap-2 sm:flex-row sm:gap-3">
              <p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-[var(--theme-text-muted)]">
                {label}
              </p>
              <div className="h-4 w-px shrink-0 bg-slate-200 max-sm:hidden dark:bg-[var(--theme-border)]" aria-hidden />
              <div className="-mx-1 max-w-full overflow-x-auto overscroll-x-contain px-1 scrollbar-none">
                <div
                  className="inline-flex min-w-max items-center gap-0.5 rounded-lg border border-[var(--theme-border-subtle)] bg-slate-100/70 p-1 shadow-surface-xs dark:bg-[var(--theme-surface-muted)]"
                  role="tablist"
                >
                  {links.map(link => {
                    const active = isActive(pathname, link.href);
                    return (
                      <Link
                        key={link.id}
                        href={link.href}
                        role="tab"
                        aria-selected={active}
                        className={centeredTabClass(active)}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </nav>
      </>
    );
  }

  return (
    <>
      <MobileSubNav label={label} sublabel={sublabel} links={links} isActive={isActive} />
      <nav
        className={`hidden md:block ${subNavShell}`}
        aria-label={`${label} navigation`}
      >
        <div className="mx-auto flex max-w-[1680px] items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
          {labelBlock}
          <div className="-mx-1 min-w-0 flex-1 overflow-x-auto overscroll-x-contain px-1 scrollbar-none">
            <div className="flex min-w-max gap-1">
              {links.map(link => (
                <Link
                  key={link.id}
                  href={link.href}
                  className={defaultTabClass(isActive(pathname, link.href))}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}

export default function PortalSubNav() {
  const pathname = usePathname();
  const { currentSlug, user, isWarehouseRoute, branches } = useApp();

  const currentBranch = useMemo(() => {
    if (!currentSlug || currentSlug === 'superadmin') return undefined;
    return (
      branches.find(b => b.slug === currentSlug) ??
      (user?.branchId ? branches.find(b => b.id === user.branchId) : undefined)
    );
  }, [branches, currentSlug, user?.branchId]);

  const branchPortalDisplay = useMemo(
    () => getBranchPortalDisplayName(currentBranch),
    [currentBranch],
  );

  const icTransferBranchLinks = useMemo(() => {
    const base = resolveICTransferBranchBase(currentSlug);
    return IC_TRANSFER_BRANCH_PORTAL_NAV.map(item => ({
      id: item.id,
      label: item.label,
      href: item.path ? `${base}${item.path}` : base,
    }));
  }, [currentSlug]);

  const icTransferAdminLinks = useMemo(() => {
    const base = resolveICTransferAdminBase(currentSlug);
    const primaryLinks = IC_TRANSFER_NAV.filter(item => !item.children).map(item => ({
      id: item.id,
      label: item.label,
      href: item.path ? `${base}${item.path}` : base,
    }));

    const settingsLinks =
      IC_TRANSFER_NAV.find(item => item.id === 'settings')?.children?.map(child => ({
        id: child.id,
        label: child.label.replace(' Management', ''),
        href: `${base}${child.path}`,
      })) ?? [];

    return [...primaryLinks, ...settingsLinks];
  }, [currentSlug]);

  const warehouseLinks = useMemo(() => {
    const base = resolveWarehouseBase(currentSlug);
    const items = user?.role?.startsWith('delivery')
      ? WAREHOUSE_NAV.filter(item => item.id === 'order-settlement')
      : WAREHOUSE_NAV.filter(item => item.id !== 'order-settlement');

    return items.map(item => ({
      id: item.id,
      label: item.label,
      href: item.path ? `${base}${item.path}` : base,
    }));
  }, [currentSlug, user]);

  const isDeliveryAgent = user?.role?.startsWith('delivery_');
  const isICTransferAdminRoute = pathname.includes('/ic-transfer-admin');
  const isICTransferBranchRoute =
    pathname.includes('/ic-transfer') && !pathname.includes('/ic-transfer-admin');

  const showBranchPortalSubNav =
    isICTransferBranchRoute &&
    user?.role === 'branch_manager' &&
    icTransferBranchLinks.length > 1;

  const showWarehouseSubNav =
    isWarehouseRoute &&
    user?.role !== 'branch_manager' &&
    user?.role !== 'staff' &&
    !isDeliveryAgent;

  if (isICTransferAdminRoute && icTransferAdminLinks.length > 1) {
    return (
      <SubNavBar
        label="Transfer Administration"
        links={icTransferAdminLinks}
        isActive={isICTransferAdminActive}
      />
    );
  }

  if (showBranchPortalSubNav) {
    return (
      <SubNavBar
        label={branchPortalDisplay.title}
        links={icTransferBranchLinks}
        isActive={isICTransferBranchActive}
      />
    );
  }

  if (showWarehouseSubNav && warehouseLinks.length > 1) {
    return (
      <SubNavBar
        label="Warehouses"
        links={warehouseLinks}
        isActive={isWarehouseActive}
        variant="centered"
      />
    );
  }

  return null;
}
