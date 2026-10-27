'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { AsicPortal } from '@/lib/asic/routing';
import {
  getVisibleAdminTopMenu,
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

function linkClass(active: boolean) {
  return `${asicNavLink} ${active ? asicNavLinkActive : ''}`;
}

function AdminTopMenu({
  slug,
  section,
}: {
  slug?: string;
  section: AsicSectionId;
}) {
  const { user } = useApp();
  const groups = getVisibleAdminTopMenu(user);

  if (groups.length === 0) return null;

  return (
    <nav className="mb-2 hidden border-b border-slate-200 pb-1.5 md:block dark:border-[var(--theme-border)]" aria-label={`${PRODUCT_NAME} admin`}>
      <div className="flex flex-wrap items-center gap-0.5">
        {groups.map((group, groupIndex) => (
          <React.Fragment key={group.id}>
            {groupIndex > 0 && (
              <span className="mx-0.5 hidden text-slate-300 sm:inline" aria-hidden>
                |
              </span>
            )}
            <div className="flex flex-wrap items-center gap-1">
              {group.items.map(item => (
                <Link
                  key={item.id}
                  href={sectionHref('admin', item.id, slug)}
                  className={linkClass(item.id === section)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </React.Fragment>
        ))}
      </div>
    </nav>
  );
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

function MobileAsicNav({
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

  const navGroups =
    portal === 'admin'
      ? getVisibleAdminTopMenu(user).map(g => ({
          id: g.id,
          label: g.id.replace('-', ' '),
          items: g.items.map(item => ({
            id: item.id,
            label: item.label,
            href: sectionHref('admin', item.id, slug),
          })),
        }))
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
    navGroups.flatMap(g => g.items).find(item => item.id === section)?.label ?? 'Menu';

  return (
    <div className="mb-2 flex items-center gap-2 border-b border-slate-200 bg-white/80 px-1 pb-2 pt-0.5 md:hidden">
      <MobileMenuButton activeSection="Sections" onClick={() => setOpen(true)} />
      <p className="min-w-0 flex-1 truncate text-right text-xs font-semibold text-slate-700">{activeLabel}</p>
      <MobileDrawer
        open={open}
        onClose={() => setOpen(false)}
        title={portalLabel(portal, user?.role)}
        subtitle="Jump to section"
      >
        <MobileNavLinkList
          groups={navGroups}
          activeId={section}
          onNavigate={() => setOpen(false)}
        />
      </MobileDrawer>
    </div>
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
  return (
    <>
      <MobileAsicNav portal={portal} slug={slug} section={section} />
      {portal === 'admin' ? (
        <AdminTopMenu slug={slug} section={section} />
      ) : (
        <PortalGroupNav portal={portal} slug={slug} section={section} />
      )}
    </>
  );
}
