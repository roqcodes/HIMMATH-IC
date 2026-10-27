export const ASIC_PORTALS = ['admin', 'branch', 'warehouse', 'delivery', 'customer', 'collection'] as const;

export type AsicPortal = (typeof ASIC_PORTALS)[number];

import { isHqOperationsPortalSlug, HQ_OPERATIONS_PORTAL_SLUG } from '@/lib/icTransfer/warehouseSlug';
import { HQ_IC_FUNDS_BRANCH_SLUG } from '@/lib/icFunds/hqBranch';

const PORTAL_SET = new Set<string>(ASIC_PORTALS);

/** "admin" is the HQ portal prefix — never a branch slug. */
export const RESERVED_BRANCH_SLUGS = new Set(['admin', 'superadmin']);

export const SYSTEM_PATHS = new Set([
  'admin',
  'branch',
  'warehouse',
  'delivery',
  'customer',
  'collection',
  'login',
  'users',
  'branches',
  'finance',
  'funds',
  'group',
  'investors',
  'invoices',
  'physical',
  'physical-deals',
  'reports',
  'settings',
  'usdt',
  'api',
]);

export type ParsedAsicPath = {
  portal: AsicPortal | 'legacy' | 'admin-root';
  branchSlug: string | null;
  section: string | null;
};

const LEGACY_IC_ADMIN_SEGMENT: Record<string, string> = {
  purchase: 'purchases',
  sales: 'sales',
  warehouse: 'warehouse',
  regions: 'regions',
  finance: 'ic-finance',
};

const LEGACY_IC_ADMIN_SETTINGS: Record<string, string> = {
  suppliers: 'suppliers',
  rates: 'rates',
  agents: 'agents',
  commission: 'commission',
  warehouses: 'warehouse',
};

function mapLegacyIcAdminTail(tail: string): string {
  if (!tail) return '/admin/dashboard';
  const parts = tail.split('/').filter(Boolean);
  if (parts[0] === 'settings') {
    const section = LEGACY_IC_ADMIN_SETTINGS[parts[1]];
    if (section) return `/admin/${section}`;
  }
  if (parts[0] === 'warehouse' && parts[1]) {
    return `/admin/warehouse/${parts[1]}`;
  }
  const section = LEGACY_IC_ADMIN_SEGMENT[parts[0]] ?? parts[0];
  return `/admin/${section}`;
}

/** Rewrite legacy / misrouted URLs to canonical /admin or /branch paths. */
export function normalizeAsicPath(pathname: string): string {
  const clean = pathname.replace(/\/$/, '') || '/';

  if (clean === '/branch/admin' || clean.startsWith('/branch/admin/')) {
    const suffix = clean.slice('/branch/admin'.length);
    return suffix ? `/admin${suffix}` : '/admin/dashboard';
  }

  if (clean === '/admin/ic-transfer-admin' || clean.startsWith('/admin/ic-transfer-admin/')) {
    const tail = clean.slice('/admin/ic-transfer-admin'.length).replace(/^\//, '');
    return mapLegacyIcAdminTail(tail);
  }

  if (clean === '/warehouse/admin' || clean.startsWith('/warehouse/admin/')) {
    const suffix = clean.slice('/warehouse/admin'.length);
    return suffix ? `/admin/warehouse${suffix}` : '/admin/warehouse';
  }

  const legacyCustomers = clean.match(/^\/([^/]+)\/customers\/?$/);
  if (legacyCustomers && !RESERVED_BRANCH_SLUGS.has(legacyCustomers[1])) {
    return `/branch/${legacyCustomers[1]}/accounts`;
  }

  return clean;
}

export function parseAsicPath(pathname: string): ParsedAsicPath {
  const normalized = normalizeAsicPath(pathname);
  const parts = normalized.split('/').filter(Boolean);
  const first = parts[0];

  if (!first || first === 'admin' || first === 'login') {
    return {
      portal: 'admin-root',
      branchSlug: null,
      section: first === 'admin' ? parts[1] ?? 'dashboard' : null,
    };
  }

  if (PORTAL_SET.has(first) && first !== 'admin') {
    const branchSlug = parts[1] ?? null;
    return {
      portal: first as AsicPortal,
      branchSlug:
        branchSlug && !RESERVED_BRANCH_SLUGS.has(branchSlug) ? branchSlug : null,
      section: parts[2] ?? null,
    };
  }

  if (SYSTEM_PATHS.has(first)) {
    return { portal: 'admin-root', branchSlug: null, section: first };
  }

  return {
    portal: 'legacy',
    branchSlug: first,
    section: parts[1] ?? null,
  };
}

export function getBranchSlugFromPath(pathname: string): string | null {
  return parseAsicPath(pathname).branchSlug;
}

export function getSessionSlugFromPath(pathname: string): string | undefined {
  const parsed = parseAsicPath(pathname);
  if (parsed.portal === 'admin-root') return undefined;
  return parsed.branchSlug ?? undefined;
}

export function portalHome(portal: AsicPortal, slug?: string): string {
  switch (portal) {
    case 'admin':
      return '/admin/dashboard';
    case 'branch':
      return `/branch/${slug}/orders`;
    case 'warehouse':
      return `/warehouse/${slug}/orders`;
    case 'delivery':
      return `/delivery/${slug}/settlement`;
    case 'customer':
      return `/customer/${slug}/orders`;
    case 'collection':
      return `/collection/${slug}/fx-settlements`;
  }
}

export function loginPath(branchSlug?: string, portal?: AsicPortal): string {
  // Warehouse, delivery, and customer portals share the branch login entry (PWA-friendly).
  if (portal === 'warehouse' || portal === 'delivery' || portal === 'customer' || portal === 'collection') {
    if (branchSlug && !isHqOperationsPortalSlug(branchSlug)) {
      return `/branch/${branchSlug}`;
    }
    return '/admin';
  }
  if (!branchSlug || RESERVED_BRANCH_SLUGS.has(branchSlug)) return '/admin';
  return `/branch/${branchSlug}`;
}

/** Branch staff login landing — redirects to orders when authenticated. */
export function branchPortalLoginPath(slug: string): string {
  return `/branch/${slug}`;
}

/** Default branch portal home after sign-in. */
export function branchPortalHomePath(slug: string): string {
  return `/branch/${slug}/orders`;
}

export function branchPortalAbsoluteUrl(slug: string, origin = ''): string {
  const path = branchPortalLoginPath(slug);
  return origin ? `${origin.replace(/\/$/, '')}${path}` : path;
}

export function postLoginPathForRole(role: string | undefined, branchSlug?: string): string {
  if (!role) return '/admin';
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'auditor') return '/admin/audit-log';

  const slug =
    branchSlug && !RESERVED_BRANCH_SLUGS.has(branchSlug) && !isHqOperationsPortalSlug(branchSlug)
      ? branchSlug
      : null;

  if (role.startsWith('delivery')) {
    return portalHome('delivery', slug ?? HQ_OPERATIONS_PORTAL_SLUG);
  }
  if (role === 'collection_agent') {
    return portalHome('collection', slug ?? HQ_IC_FUNDS_BRANCH_SLUG);
  }
  if (role.startsWith('warehouse_')) {
    return portalHome('warehouse', slug ?? HQ_OPERATIONS_PORTAL_SLUG);
  }
  if (!slug) {
    if (role === 'customer' && isHqOperationsPortalSlug(branchSlug)) {
      return portalHome('customer', HQ_IC_FUNDS_BRANCH_SLUG);
    }
    return '/admin/dashboard';
  }
  if (role === 'customer') return portalHome('customer', slug);
  if (role === 'collection_agent') return portalHome('collection', slug);
  return portalHome('branch', slug);
}

/** @deprecated Prefer resolvePostLoginPath on the server or postLoginPathForRole client-side. */
export function postLoginPath(role: string | undefined, branchSlug?: string): string {
  return postLoginPathForRole(role, branchSlug);
}

export function isAsicPortalPath(pathname: string): boolean {
  const normalized = normalizeAsicPath(pathname);
  const parts = normalized.split('/').filter(Boolean);
  const first = parts[0];
  if (first === 'admin' || PORTAL_SET.has(first ?? '')) return true;
  // Legacy /{slug}/ic-funds/* routes use the ASIC toolbar shell.
  if (parts.length >= 2 && parts[1] === 'ic-funds') return true;
  // Customer profile pages keep the ASIC section menu visible.
  if (parts.length >= 2 && parts[1] === 'customers') return true;
  if (first === 'branch' && parts[2] === 'customers') return true;
  return false;
}

export function isHqAdminPath(pathname: string): boolean {
  return parseAsicPath(pathname).portal === 'admin-root';
}
