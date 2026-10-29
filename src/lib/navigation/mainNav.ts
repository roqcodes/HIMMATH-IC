import type { Branch, User } from '@/types';
import { isBranchPageEnabled } from '@/lib/branchPages';
import { canReadPage, isCustomerRole, isInvestorRole } from '@/lib/rbac';

export type MainNavItem = {
  id: string;
  path: string;
  label: string;
  icon: string;
};

export const MAIN_NAV_ITEMS: MainNavItem[] = [
  { id: 'dashboard', path: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4' },
  { id: 'ic-transfer-admin', path: '/ic-transfer-admin', label: 'Transfer Administration', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { id: 'ic-funds', path: '/ic-funds', label: 'General Ledger', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'ic-transfer', path: '/ic-transfer', label: 'Transfer Operations', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'customers', path: '/customers', label: 'Customers', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8m12 4v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
  { id: 'settings', path: '/settings', label: 'Company Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'warehouse', path: '/warehouse', label: 'Warehouse Operations', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { id: 'users', path: '/users', label: 'User Management', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
];

const BRANCH_NAV_ORDER = [
  'dashboard', 'ic-transfer-admin', 'ic-funds', 'ic-transfer', 'customers', 'warehouse', 'settings',
] as const;

const HQ_NAV_ORDER = [
  'dashboard', 'ic-transfer', 'customers', 'settings', 'warehouse', 'users',
] as const;

const BRANCH_PAGE_IDS = new Set([
  'dashboard', 'ic-transfer-admin', 'ic-funds', 'ic-transfer', 'customers', 'settings', 'warehouse',
]);

const HQ_PAGE_IDS = new Set([
  'dashboard', 'ic-transfer', 'customers', 'settings', 'warehouse', 'users',
]);

type VisibleNavInput = {
  currentSlug: string;
  user: User | null;
  branch: Branch | null | undefined;
};

function sortNavItems(items: MainNavItem[], order: readonly string[]): MainNavItem[] {
  return items.slice().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

export function getVisibleMainNavItems({ currentSlug, user, branch }: VisibleNavInput): MainNavItem[] {
  const isBranchContext = !!currentSlug && currentSlug !== 'superadmin';

  const filtered = MAIN_NAV_ITEMS.filter(item => {
    if (isBranchContext) {
      if (isCustomerRole(user?.role)) {
        return item.id === 'ic-transfer';
      }

      if (isInvestorRole(user?.role)) {
        return false;
      }

      if (!BRANCH_PAGE_IDS.has(item.id)) return false;
      if (branch && !isBranchPageEnabled(item.id, branch.hiddenPages)) return false;
      if (
        (user?.role === 'staff' || user?.role === 'branch_manager') &&
        !canReadPage(user, item.id as import('@/lib/branchPages').BranchPageId, branch?.hiddenPages)
      ) {
        return false;
      }
      if (
        (user?.role?.startsWith('delivery') || user?.role?.startsWith('warehouse_')) &&
        item.id !== 'warehouse'
      ) {
        return false;
      }
      return true;
    }

    return HQ_PAGE_IDS.has(item.id);
  });

  return isBranchContext
    ? sortNavItems(filtered, isCustomerRole(user?.role) ? ['ic-transfer'] : BRANCH_NAV_ORDER)
    : sortNavItems(filtered, HQ_NAV_ORDER);
}

export function resolveMainNavItemHref(
  item: MainNavItem,
  currentSlug: string,
  user: User | null,
): string {
  const isHq = !currentSlug || currentSlug === 'superadmin';

  if (isHq) {
    const hqAsic: Record<string, string> = {
      dashboard: '/admin/dashboard',
      'ic-transfer-admin': '/admin/sales',
      'ic-transfer': '/admin/sales',
      customers: '/admin/customers',
      settings: '/admin/global-settings',
      users: '/admin/users',
      finance: '/admin/ic-finance',
      reports: '/admin/reconciliation',
      warehouse: '/admin/warehouse',
    };
    if (hqAsic[item.id]) return hqAsic[item.id];
    if (item.id === 'dashboard') return '/admin/dashboard';
    return item.path;
  }

  const branchAsic: Record<string, string> = {
    'ic-transfer-admin': '/admin/sales',
    'ic-transfer': '/admin/sales',
    'ic-funds': '/admin/payments',
    customers: '/admin/customers',
    settings: '/admin/rates',
    warehouse: `/warehouse/${currentSlug}/orders`,
  };
  if (branchAsic[item.id]) return branchAsic[item.id];

  const basePath = `/${currentSlug}`;

  if (item.id === 'dashboard') {
    return basePath;
  }

  if (item.id === 'warehouse' && user?.role?.startsWith('delivery')) {
    return `/delivery/${currentSlug}/settlement`;
  }

  return `${basePath}${item.path}`;
}

export function resolveCompactPortalHome(
  items: MainNavItem[],
  currentSlug: string,
  user: User | null,
): string {
  if (items.length === 0) {
    return currentSlug && currentSlug !== 'superadmin' ? `/${currentSlug}` : '/';
  }
  return resolveMainNavItemHref(items[0], currentSlug, user);
}

/** True only for the standalone Warehouse Portal (`/warehouse`), not IC Transfer warehouse pages. */
export function isWarehousePortalRoute(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  const warehouseIndex = segments.indexOf('warehouse');
  if (warehouseIndex === -1) return false;

  const parentSegment = warehouseIndex > 0 ? segments[warehouseIndex - 1] : null;
  if (parentSegment === 'ic-transfer-admin' || parentSegment === 'ic-transfer') {
    return false;
  }

  return true;
}
