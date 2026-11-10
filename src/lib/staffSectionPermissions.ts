import type { AsicSectionId } from '@/lib/asic/sections';
import { STAFF_MANAGED_SECTIONS } from '@/lib/asic/sections';
import type { BranchPageId } from '@/lib/branchPages';
import type { PageAccessLevel, PagePermissionMap } from '@/types';

/** ASIC section labels for branch staff permission UI. */
export const STAFF_SECTION_LABELS: Record<AsicSectionId, string> = {
  orders: 'Sales Orders',
  sales: 'Sales',
  purchases: 'Purchases',
  warehouse: 'Warehouses',
  counterparties: 'Counterparties',
  suppliers: 'Suppliers',
  payments: 'Payments',
  receipts: 'Receipts',
  contra: 'Contra',
  journal: 'Journal',
  fx: 'FX',
  capital: 'Capital',
  pl: 'Profit & Loss',
  accounts: 'Entities',
  entities: 'Entities',
  reports: 'Financial Reports',
  rates: 'Rates',
  dashboard: 'Dashboard',
  customers: 'Customers',
  regions: 'Regions',
  'ic-finance': 'Intercompany Finance',
  agents: 'Sales Agents',
  commission: 'Commission Rates',
  'global-settings': 'Company Settings',
  users: 'Users',
  'audit-log': 'Audit Trail',
  reconciliation: 'Reconciliation',
  'delivery-agents': 'Delivery Agents',
  settlement: 'Order Settlement',
  backup: 'Backup & Restore',
  account: 'User Profile',
};

/** Branch staff sections shown in the access editor (matches ASIC branch portal). */
export const BRANCH_STAFF_PERMISSION_SECTIONS: AsicSectionId[] = STAFF_MANAGED_SECTIONS.filter(
  id => id !== 'suppliers',
);

/** HQ admin-panel staff — configurable admin sections (excludes users/backup by default). */
export const ADMIN_STAFF_PERMISSION_SECTIONS: AsicSectionId[] = [
  'sales',
  'purchases',
  'warehouse',
  'payments',
  'receipts',
  'contra',
  'journal',
  'fx',
  'capital',
  'pl',
  'entities',
  'reports',
  'rates',
  'ic-finance',
  'regions',
  'counterparties',
  'agents',
  'commission',
  'counterparties',
  'reconciliation',
  'audit-log',
  'users',
  'backup',
  'global-settings',
];

export type StaffPermissionPortal = 'admin' | 'branch';

export function staffPermissionGroups(portal: StaffPermissionPortal): StaffPermissionGroup[] {
  const allowed = new Set(staffPermissionSections(portal));
  const groups = portal === 'admin' ? ADMIN_STAFF_PERMISSION_GROUPS : BRANCH_STAFF_PERMISSION_GROUPS;
  return groups
    .map(group => ({
      ...group,
      sections: group.sections.filter(s => allowed.has(s)),
    }))
    .filter(group => group.sections.length > 0);
}

export type StaffPermissionGroup = {
  id: string;
  label: string;
  sections: AsicSectionId[];
};

const ADMIN_STAFF_PERMISSION_GROUPS: StaffPermissionGroup[] = [
  { id: 'general', label: 'General', sections: ['dashboard'] },
  { id: 'operations', label: 'Operations', sections: ['sales', 'purchases', 'warehouse'] },
  {
    id: 'finance',
    label: 'Finance & funds',
    sections: ['payments', 'receipts', 'contra', 'journal', 'fx', 'capital', 'pl', 'entities', 'ic-finance'],
  },
  {
    id: 'master',
    label: 'Master data',
    sections: ['regions', 'counterparties', 'agents', 'commission', 'rates'],
  },
  { id: 'administration', label: 'Administration', sections: ['users', 'global-settings', 'backup'] },
  { id: 'reports', label: 'Reports & audit', sections: ['reports', 'reconciliation', 'audit-log'] },
];

const BRANCH_STAFF_PERMISSION_GROUPS: StaffPermissionGroup[] = [
  { id: 'general', label: 'General', sections: ['dashboard'] },
  { id: 'operations', label: 'Operations', sections: ['orders', 'sales', 'purchases', 'warehouse'] },
  {
    id: 'finance',
    label: 'Finance & funds',
    sections: ['payments', 'receipts', 'contra', 'journal', 'pl', 'entities', 'reports'],
  },
  { id: 'settings', label: 'Settings', sections: ['rates'] },
];

export function staffPermissionSections(portal: StaffPermissionPortal): AsicSectionId[] {
  return portal === 'admin' ? ADMIN_STAFF_PERMISSION_SECTIONS : BRANCH_STAFF_PERMISSION_SECTIONS;
}

/** Legacy DB page_id keys used by rbac + user_page_permissions. */
const SECTION_TO_LEGACY_KEYS: Partial<Record<AsicSectionId, BranchPageId[]>> = {
  orders: ['ic-transfer'],
  sales: ['ic-transfer-admin'],
  purchases: ['ic-transfer-admin'],
  warehouse: ['warehouse'],
  payments: ['ic-funds'],
  receipts: ['ic-funds'],
  contra: ['ic-funds'],
  journal: ['ic-funds'],
  fx: ['ic-funds'],
  capital: ['ic-funds'],
  pl: ['ic-funds'],
  accounts: ['ic-funds'],
  entities: ['ic-funds'],
  reports: ['ic-funds'],
  rates: ['settings'],
  customers: ['customers'],
  counterparties: ['customers'],
};

const LEGACY_TO_SECTION: Partial<Record<BranchPageId, AsicSectionId>> = {
  'ic-transfer': 'orders',
  'ic-transfer-admin': 'sales',
  warehouse: 'warehouse',
  'ic-funds': 'payments',
  customers: 'customers',
  settings: 'rates',
};

export function sectionLabel(section: AsicSectionId): string {
  return STAFF_SECTION_LABELS[section] ?? section;
}

/** Read ASIC section access from legacy permission map (uses strongest level among mapped keys). */
export function readSectionAccess(
  permissions: PagePermissionMap | undefined,
  section: AsicSectionId,
): PageAccessLevel {
  if (section === 'entities' || section === 'accounts') {
    const merged =
      permissions?.entities ??
      permissions?.accounts ??
      readSectionAccessFromLegacy(permissions, 'entities');
    if (merged !== 'none' || permissions?.entities || permissions?.accounts) {
      return merged;
    }
    return readSectionAccessFromLegacy(permissions, 'accounts');
  }

  const direct = permissions?.[section];
  if (direct === 'read' || direct === 'write' || direct === 'none') return direct;
  return readSectionAccessFromLegacy(permissions, section);
}

export function readSectionAccessFromLegacy(
  permissions: PagePermissionMap | undefined,
  section: AsicSectionId,
): PageAccessLevel {
  const keys = SECTION_TO_LEGACY_KEYS[section];
  if (!keys?.length) {
    if (section === 'dashboard') return permissions?.dashboard ?? 'read';
    return 'none';
  }
  const levels = keys.map(k => permissions?.[k]).filter(
    (l): l is PageAccessLevel => l === 'read' || l === 'write' || l === 'none',
  );
  if (levels.includes('write')) return 'write';
  if (levels.includes('read')) return 'read';
  if (levels.includes('none')) return 'none';
  return 'read';
}

/** Apply section access to legacy keys for DB storage. */
export function writeSectionAccessToLegacy(
  permissions: PagePermissionMap,
  section: AsicSectionId,
  level: PageAccessLevel,
): PagePermissionMap {
  const next = { ...permissions };
  const keys = SECTION_TO_LEGACY_KEYS[section];
  if (!keys?.length) {
    if (section === 'dashboard') next.dashboard = level;
    return next;
  }
  for (const key of keys) {
    next[key] = level;
  }
  return next;
}

export function legacyPermissionsToSectionMap(
  permissions: PagePermissionMap | undefined,
  sections: AsicSectionId[] = BRANCH_STAFF_PERMISSION_SECTIONS,
): Record<string, PageAccessLevel> {
  const result: Record<string, PageAccessLevel> = {
    dashboard: readSectionAccess(permissions, 'dashboard'),
  };
  for (const section of sections) {
    result[section] = readSectionAccess(permissions, section);
  }
  return result;
}

export function sectionMapToStoredPermissions(
  sectionMap: Record<string, PageAccessLevel>,
  portal: StaffPermissionPortal,
  base: PagePermissionMap = {},
): PagePermissionMap {
  let result = { ...base };
  if (sectionMap.dashboard) {
    result.dashboard = sectionMap.dashboard;
  }
  const sections = staffPermissionSections(portal);
  for (const section of sections) {
    const level = sectionMap[section];
    if (level === 'read' || level === 'write' || level === 'none') {
      if (portal === 'admin') {
        result[section] = level;
        if (section === 'entities') result.accounts = level;
        if (section === 'counterparties') {
          result.customers = level;
          result.suppliers = level;
        }
      } else {
        result = writeSectionAccessToLegacy(result, section, level);
      }
    }
  }
  return result;
}

/** @deprecated Use sectionMapToStoredPermissions */
export function sectionMapToLegacyPermissions(
  sectionMap: Record<string, PageAccessLevel>,
  base: PagePermissionMap = {},
): PagePermissionMap {
  return sectionMapToStoredPermissions(sectionMap, 'branch', base);
}

export function defaultAdminStaffPermissionMap(): Record<string, PageAccessLevel> {
  const result: Record<string, PageAccessLevel> = { dashboard: 'read' };
  for (const section of ADMIN_STAFF_PERMISSION_SECTIONS) {
    result[section] = 'read';
  }
  return result;
}

export function defaultAdminStaffPermissions(): PagePermissionMap {
  return sectionMapToStoredPermissions(defaultAdminStaffPermissionMap(), 'admin');
}

export function summarizePermissionsForSections(
  permissions: PagePermissionMap | undefined,
  portal: StaffPermissionPortal,
): { id: string; label: string; level: PageAccessLevel }[] {
  const sections = staffPermissionSections(portal);
  return [
    { id: 'dashboard', label: sectionLabel('dashboard'), level: readSectionAccess(permissions, 'dashboard') },
    ...sections.map(section => ({
      id: section,
      label: sectionLabel(section),
      level: readSectionAccess(permissions, section),
    })),
  ];
}

export function summarizeLegacyPermissionsForSections(
  permissions: PagePermissionMap | undefined,
  legacyPageIds: BranchPageId[],
): { id: string; label: string; level: PageAccessLevel }[] {
  const sections = new Set<AsicSectionId>();
  for (const pageId of legacyPageIds) {
    const section = LEGACY_TO_SECTION[pageId];
    if (section) sections.add(section);
  }
  const ordered = BRANCH_STAFF_PERMISSION_SECTIONS.filter(s => sections.has(s));
  return [
    { id: 'dashboard', label: sectionLabel('dashboard'), level: permissions?.dashboard ?? 'read' },
    ...ordered.map(section => ({
      id: section,
      label: sectionLabel(section),
      level: readSectionAccess(permissions, section),
    })),
  ];
}
