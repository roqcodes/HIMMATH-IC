import type { User, UserRole } from '@/types';
import type { AsicPortal } from '@/lib/asic/routing';
import { RESERVED_BRANCH_SLUGS } from '@/lib/asic/routing';
import { canReadSection, type AsicSectionId } from '@/lib/asic/pages';
import { sectionLabel } from '@/lib/staffSectionPermissions';
import {
  icFundsReportPath,
  isICFundsReportId,
  type ICFundsReportId,
} from '@/lib/icFunds/nav';

const L = (id: AsicSectionId) => sectionLabel(id);

export type AsicNavGroupId = 'operations' | 'master' | 'finance' | 'settings' | 'management';

export type AsicNavItem = {
  id: AsicSectionId;
  label: string;
  group: AsicNavGroupId;
};

export type AsicAdminNavLink = { id: AsicSectionId; label: string };

export type AsicAdminReportNavLink = { reportView: ICFundsReportId; label: string };

export type AsicAdminSidebarGroupItem = AsicAdminNavLink | AsicAdminReportNavLink;

export type AsicAdminSidebarEntry =
  | { type: 'link'; id: AsicSectionId; label: string }
  | { type: 'group'; id: string; label: string; items: AsicAdminSidebarGroupItem[] };

export function isAdminReportNavLink(item: AsicAdminSidebarGroupItem): item is AsicAdminReportNavLink {
  return 'reportView' in item;
}

export function adminSidebarGroupItemId(item: AsicAdminSidebarGroupItem): string {
  return isAdminReportNavLink(item) ? `reports:${item.reportView}` : item.id;
}

export function adminSidebarGroupItemHref(
  item: AsicAdminSidebarGroupItem,
  slug?: string,
): string {
  if (isAdminReportNavLink(item)) return icFundsReportPath('', item.reportView, 'admin');
  return sectionHref('admin', item.id, slug);
}

export function adminMobileNavActiveId(section: AsicSectionId, reportView: string | null): string {
  if (section === 'reports') {
    return isICFundsReportId(reportView) ? `reports:${reportView}` : 'reports';
  }
  return section;
}

export type AsicAdminMobileNavItem = { id: string; label: string; href: string };

/** Admin sidebar — primary navigation (replaces former top toolbar menu). */
export const ADMIN_SIDEBAR_NAV: AsicAdminSidebarEntry[] = [
  { type: 'link', id: 'dashboard', label: L('dashboard') },
  { type: 'link', id: 'warehouse', label: L('warehouse') },
  { type: 'link', id: 'purchases', label: L('purchases') },
  { type: 'link', id: 'sales', label: L('sales') },
  {
    type: 'group',
    id: 'accounting',
    label: 'Accounting',
    items: [
      { id: 'entities', label: L('entities') },
      { id: 'payments', label: L('payments') },
      { id: 'receipts', label: L('receipts') },
      { id: 'contra', label: L('contra') },
      { id: 'journal', label: L('journal') },
    ],
  },
  { type: 'link', id: 'reports', label: L('reports') },
  {
    type: 'group',
    id: 'settings',
    label: 'Settings',
    items: [
      { id: 'counterparties', label: L('counterparties') },
      { id: 'rates', label: L('rates') },
      { id: 'users', label: L('users') },
      { id: 'backup', label: L('backup') },
    ],
  },
];

export const ASIC_NAV_GROUPS: { id: AsicNavGroupId; label: string }[] = [
  { id: 'operations', label: 'Operations' },
  { id: 'master', label: 'Master Data' },
  { id: 'finance', label: 'Finance' },
  { id: 'settings', label: 'Settings' },
  { id: 'management', label: 'Management' },
];

/** All admin sections (including hidden-from-menu routes). */
export const ADMIN_NAV: readonly AsicNavItem[] = [
  { id: 'dashboard', label: L('dashboard'), group: 'operations' },
  { id: 'sales', label: L('sales'), group: 'operations' },
  { id: 'purchases', label: L('purchases'), group: 'operations' },
  { id: 'warehouse', label: L('warehouse'), group: 'operations' },
  { id: 'payments', label: L('payments'), group: 'finance' },
  { id: 'receipts', label: L('receipts'), group: 'finance' },
  { id: 'contra', label: L('contra'), group: 'finance' },
  { id: 'journal', label: L('journal'), group: 'finance' },
  { id: 'pl', label: L('pl'), group: 'finance' },
  { id: 'entities', label: L('entities'), group: 'finance' },
  { id: 'accounts', label: L('accounts'), group: 'finance' },
  { id: 'reports', label: L('reports'), group: 'finance' },
  { id: 'ic-finance', label: L('ic-finance'), group: 'finance' },
  { id: 'rates', label: L('rates'), group: 'settings' },
  { id: 'global-settings', label: L('global-settings'), group: 'settings' },
  { id: 'users', label: L('users'), group: 'management' },
  { id: 'audit-log', label: L('audit-log'), group: 'management' },
  { id: 'reconciliation', label: L('reconciliation'), group: 'management' },
  { id: 'backup', label: L('backup'), group: 'management' },
  { id: 'account', label: L('account'), group: 'management' },
  // Hidden from menu — routes remain valid for bookmarks / legacy URLs
  { id: 'counterparties', label: L('counterparties'), group: 'master' },
  { id: 'regions', label: L('regions'), group: 'master' },
  { id: 'agents', label: L('agents'), group: 'settings' },
  { id: 'commission', label: L('commission'), group: 'settings' },
];

export const BRANCH_NAV: readonly AsicNavItem[] = [];

export const WAREHOUSE_NAV: readonly AsicNavItem[] = [
  { id: 'orders', label: L('orders'), group: 'operations' },
  { id: 'delivery-agents', label: L('delivery-agents'), group: 'operations' },
];

export const DELIVERY_NAV: readonly AsicNavItem[] = [
  { id: 'settlement', label: L('settlement'), group: 'operations' },
  { id: 'account', label: L('account'), group: 'settings' },
];

export const CUSTOMER_NAV: readonly AsicNavItem[] = [
  { id: 'orders', label: L('orders'), group: 'operations' },
];

export const COLLECTION_NAV: readonly AsicNavItem[] = [];

export function navForPortal(portal: AsicPortal): readonly AsicNavItem[] {
  switch (portal) {
    case 'admin':
    case 'branch':
    case 'collection':
      return ADMIN_NAV;
    case 'warehouse':
      return WAREHOUSE_NAV;
    case 'delivery':
      return DELIVERY_NAV;
    case 'customer':
      return CUSTOMER_NAV;
  }
}

export function sectionHref(portal: AsicPortal, section: AsicSectionId, slug?: string): string {
  if (portal === 'admin' || !slug || RESERVED_BRANCH_SLUGS.has(slug)) return `/admin/${section}`;
  return `/${portal}/${slug}/${section}`;
}

export function getVisibleNav(
  portal: AsicPortal,
  user: Pick<User, 'role' | 'permissions'> | null,
): AsicNavItem[] {
  return navForPortal(portal).filter(
    item =>
      item.id !== 'accounts' &&
      item.id !== 'account' &&
      canReadSection(user, item.id, portal),
  );
}

function canShowAdminNavSection(
  user: Pick<User, 'role' | 'permissions'> | null,
  sectionId: AsicSectionId,
): boolean {
  return (
    sectionId !== 'account' &&
    canReadSection(user, sectionId, 'admin')
  );
}

export function getVisibleAdminSidebarNav(
  user: Pick<User, 'role' | 'permissions'> | null,
): AsicAdminSidebarEntry[] {
  const visible: AsicAdminSidebarEntry[] = [];

  for (const entry of ADMIN_SIDEBAR_NAV) {
    if (entry.type === 'link') {
      if (canShowAdminNavSection(user, entry.id)) visible.push(entry);
      continue;
    }

    if (entry.id === 'reports') {
      if (canShowAdminNavSection(user, 'reports')) visible.push(entry);
      continue;
    }

    const items = entry.items.filter(
      item => !isAdminReportNavLink(item) && canShowAdminNavSection(user, item.id),
    );
    if (items.length > 0) visible.push({ ...entry, items });
  }

  return visible;
}

/** Flat groups for mobile drawer navigation. */
export function getVisibleAdminMobileNavGroups(
  user: Pick<User, 'role' | 'permissions'> | null,
  slug?: string,
): { id: string; label?: string; items: AsicAdminMobileNavItem[] }[] {
  const groups: { id: string; label?: string; items: AsicAdminMobileNavItem[] }[] = [];
  let flat: AsicAdminMobileNavItem[] = [];

  const flushFlat = () => {
    if (flat.length === 0) return;
    groups.push({ id: `flat-${groups.length}`, items: flat });
    flat = [];
  };

  for (const entry of getVisibleAdminSidebarNav(user)) {
    if (entry.type === 'link') {
      flat.push({
        id: entry.id,
        label: entry.label,
        href: sectionHref('admin', entry.id, slug),
      });
      continue;
    }
    flushFlat();
    groups.push({
      id: entry.id,
      label: entry.label,
      items: entry.items.map(item => ({
        id: adminSidebarGroupItemId(item),
        label: item.label,
        href: adminSidebarGroupItemHref(item, slug),
      })),
    });
  }
  flushFlat();

  return groups;
}

export function groupNav(items: AsicNavItem[]): { group: AsicNavGroupId; label: string; items: AsicNavItem[] }[] {
  const byGroup = new Map<AsicNavGroupId, AsicNavItem[]>();
  for (const item of items) {
    const list = byGroup.get(item.group) ?? [];
    list.push(item);
    byGroup.set(item.group, list);
  }
  return ASIC_NAV_GROUPS.filter(g => byGroup.has(g.id)).map(g => ({
    group: g.id,
    label: g.label,
    items: byGroup.get(g.id) ?? [],
  }));
}

export function defaultSection(portal: AsicPortal): AsicSectionId {
  switch (portal) {
    case 'admin':
      return 'dashboard';
    case 'warehouse':
      return 'orders';
    case 'delivery':
      return 'settlement';
    case 'customer':
      return 'orders';
    default:
      return 'dashboard';
  }
}

export function isAsicSection(value: string): value is AsicSectionId {
  const all = new Set<string>([
    ...ADMIN_NAV.map(i => i.id),
    ...BRANCH_NAV.map(i => i.id),
    ...WAREHOUSE_NAV.map(i => i.id),
    ...DELIVERY_NAV.map(i => i.id),
    ...CUSTOMER_NAV.map(i => i.id),
    ...COLLECTION_NAV.map(i => i.id),
  ]);
  return all.has(value);
}

export function portalLabel(portal: AsicPortal, role?: UserRole | string): string {
  if (portal === 'admin') return role === 'auditor' ? 'Auditor Portal' : 'Administration';
  if (portal === 'warehouse') return 'Warehouse Operations';
  if (portal === 'delivery') return 'Delivery Operations';
  return 'Customer Portal';
}
