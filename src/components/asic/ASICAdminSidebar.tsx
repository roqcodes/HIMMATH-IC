'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  adminSidebarGroupItemHref,
  getVisibleAdminSidebarNav,
  isAdminReportNavLink,
  sectionHref,
  type AsicAdminSidebarEntry,
  type AsicAdminSidebarGroupItem,
} from '@/lib/asic/nav';
import type { AsicSectionId } from '@/lib/asic/pages';
import { isICFundsReportId } from '@/lib/icFunds/nav';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { PRODUCT_NAME } from '@/lib/brand';
import { AdminSidebarIcon } from '@/components/asic/adminSidebarIcons';
import { adminShellSidebar } from '@/components/layout/adminShell';
import { iconBtn } from '@/lib/ui';
import { ChevronDown, PanelLeftClose } from 'lucide-react';

const STORAGE_KEY = 'himmath.adminSidebarCollapsed';

const NAV_MOTION =
  'transition-[background-color,box-shadow,color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none';

function groupContainsSection(entry: Extract<AsicAdminSidebarEntry, { type: 'group' }>, section: AsicSectionId) {
  if (entry.id === 'reports') return section === 'reports';
  return entry.items.some(item => !isAdminReportNavLink(item) && item.id === section);
}

function SidebarGroupItemLink({
  item,
  section,
  reportView,
  slug,
  collapsed,
}: {
  item: AsicAdminSidebarGroupItem;
  section: AsicSectionId;
  reportView: string | null;
  slug?: string;
  collapsed: boolean;
}) {
  if (isAdminReportNavLink(item)) {
    const resolvedView = isICFundsReportId(reportView) ? reportView : 'all-vouchers';
    const active = section === 'reports' && item.reportView === resolvedView;
    return (
      <SidebarLink
        key={item.reportView}
        id="reports"
        label={item.label}
        href={adminSidebarGroupItemHref(item, slug)}
        active={active}
        collapsed={collapsed}
      />
    );
  }
  return (
    <SidebarLink
      key={item.id}
      id={item.id}
      label={item.label}
      href={sectionHref('admin', item.id, slug)}
      active={item.id === section}
      collapsed={collapsed}
    />
  );
}

function navItemClass(active: boolean, collapsed: boolean) {
  return [
    'group relative flex w-full items-center gap-2.5 rounded-lg text-sm font-medium no-underline',
    NAV_MOTION,
    collapsed ? 'justify-center px-2 py-2.5' : 'px-2.5 py-2',
    active
      ? 'bg-white text-slate-900 shadow-surface-xs ring-1 ring-slate-200/90 dark:bg-[var(--theme-surface-raised)] dark:text-[var(--theme-text)] dark:ring-[var(--theme-border)]'
      : 'text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-[var(--theme-text-secondary)] dark:hover:bg-[var(--theme-surface-hover)] dark:hover:text-[var(--theme-text)]',
  ].join(' ');
}

function ActiveRail({ active }: { active: boolean }) {
  return (
    <span
      className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[var(--theme-accent)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
        active ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'
      }`}
      aria-hidden
    />
  );
}

function SidebarRevealText({
  show,
  children,
  className = '',
}: {
  show: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`admin-sidebar-reveal overflow-hidden ${className} ${
        show ? 'max-w-[12rem] translate-x-0 opacity-100' : 'max-w-0 -translate-x-1 opacity-0'
      }`}
    >
      {children}
    </div>
  );
}

function SidebarLink({
  id,
  label,
  href,
  active,
  collapsed,
}: {
  id: string;
  label: string;
  href: string;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      className={navItemClass(active, collapsed)}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? label : undefined}
    >
      <ActiveRail active={active} />
      <AdminSidebarIcon
        id={id}
        className={`size-[18px] shrink-0 transition-colors duration-300 ease-out motion-reduce:transition-none ${
          active ? 'text-[var(--theme-accent)]' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
        }`}
      />
      <SidebarRevealText show={!collapsed} className="min-w-0 flex-1 truncate whitespace-nowrap">
        {label}
      </SidebarRevealText>
    </Link>
  );
}

function SidebarAccordion({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`admin-sidebar-accordion ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      aria-hidden={!open}
    >
      <div className="overflow-hidden">
        <div className="ml-3 flex flex-col gap-0.5 border-l border-slate-200/90 pl-2 pt-0.5 dark:border-[var(--theme-border)]">
          {children}
        </div>
      </div>
    </div>
  );
}

function SidebarGroup({
  entry,
  section,
  slug,
  collapsed,
  reportView,
}: {
  entry: Extract<AsicAdminSidebarEntry, { type: 'group' }>;
  section: AsicSectionId;
  slug?: string;
  collapsed: boolean;
  reportView: string | null;
}) {
  const activeInGroup = groupContainsSection(entry, section);
  const [open, setOpen] = useState(activeInGroup);
  const [flyoutOpen, setFlyoutOpen] = useState(false);

  useEffect(() => {
    if (activeInGroup) setOpen(true);
  }, [activeInGroup]);

  useEffect(() => {
    if (!collapsed) setFlyoutOpen(false);
  }, [collapsed]);

  if (collapsed) {
    return (
      <div
        className="relative"
        onMouseEnter={() => setFlyoutOpen(true)}
        onMouseLeave={() => setFlyoutOpen(false)}
      >
        <button
          type="button"
          className={navItemClass(activeInGroup, true)}
          aria-expanded={flyoutOpen}
          aria-haspopup="true"
          title={entry.label}
          onClick={() => setFlyoutOpen(v => !v)}
        >
          <ActiveRail active={activeInGroup} />
          <AdminSidebarIcon
            id={entry.id}
            className={`size-[18px] ${activeInGroup ? 'text-[var(--theme-accent)]' : 'text-slate-400'}`}
          />
        </button>
        <div
          className={`admin-sidebar-flyout pointer-events-none absolute left-[calc(100%+6px)] top-0 z-50 min-w-[11rem] origin-top-left rounded-lg border border-slate-200/90 bg-white p-1.5 shadow-dropdown dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] ${
            flyoutOpen
              ? 'pointer-events-auto translate-x-0 scale-100 opacity-100'
              : '-translate-x-1 scale-[0.98] opacity-0'
          }`}
        >
          <p className="mb-1 px-2 pt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            {entry.label}
          </p>
          {entry.items.map(item => (
            <SidebarGroupItemLink
              key={isAdminReportNavLink(item) ? item.reportView : item.id}
              item={item}
              section={section}
              reportView={reportView}
              slug={slug}
              collapsed={false}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className={`${navItemClass(activeInGroup, false)} justify-between`}
        aria-expanded={open}
      >
        <ActiveRail active={activeInGroup} />
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <AdminSidebarIcon
            id={entry.id}
            className={`size-[18px] shrink-0 ${activeInGroup ? 'text-[var(--theme-accent)]' : 'text-slate-400'}`}
          />
          <span className="truncate">{entry.label}</span>
        </span>
        <ChevronDown
          className={`size-3.5 shrink-0 text-slate-400 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
            open ? 'rotate-180' : 'rotate-0'
          }`}
          strokeWidth={1.75}
          aria-hidden
        />
      </button>
      <SidebarAccordion open={open}>
        {entry.items.map(item => (
          <SidebarGroupItemLink
            key={isAdminReportNavLink(item) ? item.reportView : item.id}
            item={item}
            section={section}
            reportView={reportView}
            slug={slug}
            collapsed={false}
          />
        ))}
      </SidebarAccordion>
    </div>
  );
}

export default function ASICAdminSidebar({
  section,
  slug,
}: {
  section: AsicSectionId;
  slug?: string;
}) {
  const { user, compactPortalHome } = useApp();
  const searchParams = useSearchParams();
  const reportView = searchParams.get('view');
  const entries = useMemo(() => getVisibleAdminSidebarNav(user), [user]);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed, hydrated]);

  if (entries.length === 0) return null;

  const widthClass = collapsed ? 'w-[4.25rem]' : 'w-[15.5rem]';

  return (
    <aside
      className={`${adminShellSidebar} ${widthClass}`}
      aria-label={`${PRODUCT_NAME} admin`}
    >
      <div
        className={`flex h-14 w-full shrink-0 items-center gap-0.5 border-b border-slate-200/80 transition-[padding] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none dark:border-[var(--theme-border)] ${
          collapsed ? 'px-1' : 'gap-1 px-2.5'
        }`}
      >
        <Link
          href={compactPortalHome ?? '/admin/dashboard'}
          className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg no-underline transition-colors duration-300 hover:bg-white/60 dark:hover:bg-[var(--theme-surface-hover)] ${
            collapsed ? 'min-w-0 p-0.5' : 'p-1'
          }`}
          title={PRODUCT_NAME}
        >
          <div
            className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-surface-xs ring-1 ring-slate-900/[0.03] dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-raised)] ${
              collapsed ? 'size-8' : 'size-9'
            }`}
          >
            <img src="/logo.png" alt="" className={`object-contain ${collapsed ? 'size-5' : 'size-6'}`} />
          </div>
          <SidebarRevealText show={!collapsed} className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold tracking-tight text-slate-900 dark:text-[var(--theme-text)]">
              {PRODUCT_NAME}
            </span>
            <span className="block truncate text-[11px] font-medium text-slate-500 dark:text-[var(--theme-text-muted)]">
              Admin workspace
            </span>
          </SidebarRevealText>
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed(v => !v)}
          className={`${iconBtn} shrink-0 text-slate-500 hover:text-slate-800 dark:text-[var(--theme-text-secondary)] dark:hover:text-[var(--theme-text)] ${
            collapsed ? 'size-7' : 'size-8'
          }`}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <PanelLeftClose
            className={`size-[17px] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
              collapsed ? 'rotate-180' : 'rotate-0'
            }`}
            strokeWidth={1.75}
            aria-hidden
          />
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-2 py-3 scrollbar-thin">
        <p
          className={`mb-1.5 overflow-hidden px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 transition-[max-height,opacity,margin] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
            collapsed ? 'mb-0 max-h-0 opacity-0' : 'max-h-8 opacity-100'
          }`}
        >
          Navigation
        </p>
        {entries.map(entry => {
          if (entry.type === 'link') {
            return (
              <SidebarLink
                key={entry.id}
                id={entry.id}
                label={entry.label}
                href={sectionHref('admin', entry.id, slug)}
                active={entry.id === section}
                collapsed={collapsed}
              />
            );
          }
          return (
            <SidebarGroup
              key={entry.id}
              entry={entry}
              section={section}
              slug={slug}
              collapsed={collapsed}
              reportView={isICFundsReportId(reportView) ? reportView : section === 'reports' ? 'all-vouchers' : null}
            />
          );
        })}
      </nav>
    </aside>
  );
}
