import type { User, UserRole } from '@/types';
import type { AsicPortal } from '@/lib/asic/routing';
import { RESERVED_BRANCH_SLUGS } from '@/lib/asic/routing';
import { canReadSection, type AsicSectionId } from '@/lib/asic/pages';

export type AsicNavGroupId = 'operations' | 'master' | 'finance' | 'settings' | 'management';

export type AsicNavItem = {
  id: AsicSectionId;
  label: string;
  group: AsicNavGroupId;
};

export type AsicAdminTopMenuGroup = {
  id: string;
  items: { id: AsicSectionId; label: string }[];
};

/** Admin top menu — grouped sections separated by dividers in the toolbar. */
export const ADMIN_TOP_MENU_GROUPS: AsicAdminTopMenuGroup[] = [
  {
    id: 'operations',
    items: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'purchases', label: 'Purchase' },
      { id: 'sales', label: 'Sales' },
      { id: 'warehouse', label: 'Warehouse' },
      { id: 'suppliers', label: 'Suppliers' },
    ],
  },
  {
    id: 'finance',
    items: [
      { id: 'payments', label: 'Payments' },
      { id: 'receipts', label: 'Receipts' },
      { id: 'contra', label: 'Contra' },
      { id: 'journal', label: 'Journal' },
      { id: 'pl', label: 'P&L' },
      { id: 'rates', label: 'Rates' },
      { id: 'fx-settlements', label: 'FX' },
    ],
  },
  {
    id: 'administration',
    items: [
      { id: 'branches', label: 'Branches' },
      { id: 'accounts', label: 'Accounts' },
      { id: 'users', label: 'Users' },
    ],
  },
  {
    id: 'reporting',
    items: [
      { id: 'reports', label: 'Reports' },
      { id: 'backup', label: 'Backup' },
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
  { id: 'dashboard', label: 'Dashboard', group: 'operations' },
  { id: 'sales', label: 'Sales', group: 'operations' },
  { id: 'purchases', label: 'Purchase', group: 'operations' },
  { id: 'warehouse', label: 'Warehouse', group: 'operations' },
  { id: 'payments', label: 'Payments', group: 'finance' },
  { id: 'receipts', label: 'Receipts', group: 'finance' },
  { id: 'contra', label: 'Contra', group: 'finance' },
  { id: 'journal', label: 'Journal', group: 'finance' },
  { id: 'pl', label: 'P&L', group: 'finance' },
  { id: 'reports', label: 'Reports', group: 'finance' },
  { id: 'ic-finance', label: 'IC Finance', group: 'finance' },
  { id: 'rates', label: 'Rates', group: 'settings' },
  { id: 'global-settings', label: 'Global', group: 'settings' },
  { id: 'branches', label: 'Branches', group: 'management' },
  { id: 'accounts', label: 'Accounts', group: 'management' },
  { id: 'users', label: 'Users', group: 'management' },
  { id: 'audit-log', label: 'Audit log', group: 'management' },
  { id: 'reconciliation', label: 'Reconcile', group: 'management' },
  { id: 'backup', label: 'Backup', group: 'management' },
  { id: 'account', label: 'Account', group: 'management' },
  // Hidden from menu — routes remain valid for bookmarks / legacy URLs
  { id: 'customers', label: 'Customers', group: 'master' },
  { id: 'regions', label: 'Regions', group: 'master' },
  { id: 'suppliers', label: 'Suppliers', group: 'master' },
  { id: 'fx-settlements', label: 'FX', group: 'finance' },
  { id: 'agents', label: 'Agents', group: 'settings' },
  { id: 'commission', label: 'Commission', group: 'settings' },
];

export const BRANCH_NAV: readonly AsicNavItem[] = [
  { id: 'orders', label: 'Orders', group: 'operations' },
  { id: 'sales', label: 'Sales', group: 'operations' },
  { id: 'purchases', label: 'Purchase', group: 'operations' },
  { id: 'warehouse', label: 'Warehouse', group: 'operations' },
  { id: 'payments', label: 'Payments', group: 'finance' },
  { id: 'receipts', label: 'Receipts', group: 'finance' },
  { id: 'contra', label: 'Contra', group: 'finance' },
  { id: 'journal', label: 'Journal', group: 'finance' },
  { id: 'pl', label: 'P&L', group: 'finance' },
  { id: 'accounts', label: 'Accounts', group: 'finance' },
  { id: 'reports', label: 'Reports', group: 'finance' },
  { id: 'fx-settlements', label: 'FX', group: 'finance' },
  { id: 'rates', label: 'Rates', group: 'settings' },
  { id: 'users', label: 'Staff', group: 'settings' },
  { id: 'account', label: 'Account', group: 'settings' },
  // Hidden from menu — /customers redirects to accounts
  { id: 'customers', label: 'Customers', group: 'master' },
];

export const WAREHOUSE_NAV: readonly AsicNavItem[] = [
  { id: 'orders', label: 'Orders', group: 'operations' },
  { id: 'delivery-agents', label: 'Delivery', group: 'operations' },
  { id: 'account', label: 'Account', group: 'settings' },
];

export const DELIVERY_NAV: readonly AsicNavItem[] = [
  { id: 'settlement', label: 'Settlement', group: 'operations' },
  { id: 'account', label: 'Account', group: 'settings' },
];

export const CUSTOMER_NAV: readonly AsicNavItem[] = [
  { id: 'orders', label: 'Orders', group: 'operations' },
  { id: 'wallet', label: 'Wallet', group: 'operations' },
];

export const COLLECTION_NAV: readonly AsicNavItem[] = [
  { id: 'fx-settlements', label: 'Remittance', group: 'operations' },
  { id: 'account', label: 'Account', group: 'settings' },
];

export function navForPortal(portal: AsicPortal): readonly AsicNavItem[] {
  switch (portal) {
    case 'admin':
      return ADMIN_NAV;
    case 'branch':
      return BRANCH_NAV;
    case 'warehouse':
      return WAREHOUSE_NAV;
    case 'delivery':
      return DELIVERY_NAV;
    case 'customer':
      return CUSTOMER_NAV;
    case 'collection':
      return COLLECTION_NAV;
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
    item => item.id !== 'customers' && item.id !== 'account' && canReadSection(user, item.id, portal),
  );
}

export function getVisibleAdminTopMenu(
  user: Pick<User, 'role' | 'permissions'> | null,
): AsicAdminTopMenuGroup[] {
  return ADMIN_TOP_MENU_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(
      item => item.id !== 'customers' && item.id !== 'account' && canReadSection(user, item.id, 'admin'),
    ),
  })).filter(group => group.items.length > 0);
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
    case 'branch':
      return 'orders';
    case 'warehouse':
      return 'orders';
    case 'delivery':
      return 'settlement';
    case 'customer':
      return 'orders';
    case 'collection':
      return 'fx-settlements';
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
  if (portal === 'admin') return role === 'auditor' ? 'Auditor' : 'Admin';
  if (portal === 'branch') return 'Branch';
  if (portal === 'warehouse') return 'Warehouse';
  if (portal === 'delivery') return 'Delivery';
  if (portal === 'collection') return 'Collection';
  return 'Customer';
}
