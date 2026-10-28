'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import type { AsicPortal } from '@/lib/asic/routing';
import {
  adminMobileNavActiveId,
  getVisibleAdminMobileNavGroups,
  getVisibleNav,
  groupNav,
  portalLabel,
  sectionHref,
  type AsicNavItem,
} from '@/lib/asic/nav';
import type { AsicSectionId } from '@/lib/asic/pages';
import { asicNavLink, asicNavLinkActive } from '@/components/asic/ui';
import { useApp } from '@/context/AppContext';
import MobileDrawer from '@/components/ui/MobileDrawer';
import { MobileMenuButton, MobileNavLinkList } from '@/components/layout/MobileNav';
import { PRODUCT_NAME } from '@/lib/brand';
import { useSearchParams } from 'next/navigation';

function linkClass(active: boolean) {
  return `${asicNavLink} ${active ? asicNavLinkActive : ''}`;
}

function PortalGroupNav({
  portal,
  slug,
  section,
}: {
  portal: AsicPortal;
  slug?: string;
  section: AsicSectionId;
}) {
  const { user } = useApp();
  const items = getVisibleNav(portal, user);
  const groups = groupNav(items);

  return (
    <nav className="mb-2 hidden overflow-x-auto border-b border-slate-200 pb-2 scrollbar-none md:block dark:border-[var(--theme-border)]" aria-label={PRODUCT_NAME}>
      <div className="flex min-w-max flex-wrap items-center gap-1">
        {groups.map((group, groupIndex) => (
          <React.Fragment key={group.group}>
            {groupIndex > 0 && (
              <span className="mx-0.5 text-slate-300" aria-hidden>
                |
              </span>
            )}
            {group.items.map((item: AsicNavItem) => (
              <Link
                key={item.id}
                href={sectionHref(portal, item.id, slug)}
                className={linkClass(item.id === section)}
              >
                {item.label}
              </Link>
            ))}
          </React.Fragment>
        ))}
      </div>
    </nav>
  );
}

function MobileAsicNavInner({
  portal,
  slug,
  section,
}: {
  portal: AsicPortal;
  slug?: string;
  section: AsicSectionId;
}) {
  const [open, setOpen] = useState(false);
  const { user } = useApp();
  const searchParams = useSearchParams();
  const activeNavId = adminMobileNavActiveId(section, searchParams.get('view'));

  const navGroups =
    portal === 'admin'
      ? getVisibleAdminMobileNavGroups(user, slug)
      : groupNav(getVisibleNav(portal, user)).map(g => ({
          id: g.group,
          label: g.label,
          items: g.items.map(item => ({
            id: item.id,
            label: item.label,
            href: sectionHref(portal, item.id, slug),
          })),
        }));

  const activeLabel =
    navGroups.flatMap(g => g.items).find(item => item.id === activeNavId)?.label ?? 'Menu';

  return (
    <div className="mb-2 flex items-center gap-2 border-b border-slate-200 bg-white/80 px-1 pb-2 pt-0.5 md:hidden">
      <MobileMenuButton activeSection="Sections" onClick={() => setOpen(true)} />
      <p className="min-w-0 flex-1 truncate text-right text-xs font-semibold text-slate-700">{activeLabel}</p>
      <MobileDrawer
        open={open}
        onClose={() => setOpen(false)}
        title={portalLabel(portal, user?.role)}
      >
        <MobileNavLinkList
          groups={navGroups}
          activeId={activeNavId}
          onNavigate={() => setOpen(false)}
        />
      </MobileDrawer>
    </div>
  );
}

function MobileAsicNav(props: {
  portal: AsicPortal;
  slug?: string;
  section: AsicSectionId;
}) {
  return (
    <Suspense fallback={null}>
      <MobileAsicNavInner {...props} />
    </Suspense>
  );
}

export default function ASICToolbar({
  portal,
  slug,
  section,
}: {
  portal: AsicPortal;
  slug?: string;
  section: AsicSectionId;
}) {
  if (portal === 'admin') {
    return <MobileAsicNav portal={portal} slug={slug} section={section} />;
  }

  return (
    <>
      <MobileAsicNav portal={portal} slug={slug} section={section} />
      <PortalGroupNav portal={portal} slug={slug} section={section} />
    </>
  );
}
