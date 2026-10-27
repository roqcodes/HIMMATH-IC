import type { User, UserRole } from '@/types';
import type { AsicPortal } from '@/lib/asic/routing';
import type { PageAccessLevel } from '@/types';
import { isHqAdminStaff } from '@/lib/icFunds/hqBranch';
import { readSectionAccess } from '@/lib/staffSectionPermissions';
import type { AsicSectionId } from '@/lib/asic/sections';

export type { AsicSectionId } from '@/lib/asic/sections';
export { STAFF_MANAGED_SECTIONS } from '@/lib/asic/sections';

const LEGACY_PAGE_TO_SECTION: Record<string, AsicSectionId> = {
  dashboard: 'dashboard',
  'ic-transfer': 'orders',
  'ic-transfer-branch': 'orders',
  'ic-transfer-admin': 'sales',
  'ic-funds': 'payments',
  customers: 'customers',
  warehouse: 'warehouse',
  settings: 'rates',
};

export function mapLegacyPageId(pageId: string): AsicSectionId | null {
  return LEGACY_PAGE_TO_SECTION[pageId] ?? null;
}

export function isAuditorRole(role: UserRole | string | undefined): boolean {
  return role === 'auditor';
}

export function getEffectiveSectionAccess(
  user: Pick<User, 'role' | 'permissions'> | null | undefined,
  section: AsicSectionId,
  portal: AsicPortal,
): PageAccessLevel {
  if (!user) return 'none';

  if (user.role === 'admin') return 'write';
  if (isAuditorRole(user.role)) {
    return portal === 'admin' ? 'read' : 'none';
  }

  if (user.role === 'customer') {
    return portal === 'customer' && (section === 'orders' || section === 'wallet') ? 'write' : 'none';
  }

  if (user.role === 'collection_agent') {
    if (portal !== 'collection') return 'none';
    if (section === 'fx-settlements' || section === 'account') return 'write';
    return 'none';
  }

  if (section === 'account') {
    if (portal === 'admin' && isHqAdminStaff(user)) return 'write';
    if (portal === 'branch' && (user.role === 'staff' || user.role === 'branch_manager')) return 'write';
    if (portal === 'warehouse' && user.role.startsWith('warehouse_')) return 'write';
    if (portal === 'delivery' && user.role.startsWith('delivery')) return 'write';
    return 'none';
  }

  if (user.role.startsWith('delivery')) {
    return portal === 'delivery' && section === 'settlement' ? 'write' : 'none';
  }

  if (user.role.startsWith('warehouse_')) {
    return portal === 'warehouse' && (section === 'orders' || section === 'delivery-agents')
      ? 'write'
      : 'none';
  }

  if (user.role === 'branch_manager') {
    if (portal !== 'branch' && portal !== 'admin') return 'none';
    if (section === 'users' && portal === 'branch') return 'write';
    if (section === 'branches' || section === 'global-settings' || section === 'backup') {
      return 'none';
    }
    if (section === 'users' && portal === 'admin') return 'none';
    if (section === 'audit-log' || section === 'reconciliation') return 'read';
    return 'write';
  }

  if (user.role === 'staff') {
    if (portal === 'admin' && isHqAdminStaff(user)) {
      return readSectionAccess(user.permissions, section);
    }
    if (portal === 'branch') {
      return readSectionAccess(user.permissions, section);
    }
    return 'none';
  }

  return 'none';
}

export function canReadSection(
  user: Pick<User, 'role' | 'permissions'> | null | undefined,
  section: AsicSectionId,
  portal: AsicPortal,
): boolean {
  const access = getEffectiveSectionAccess(user, section, portal);
  return access === 'read' || access === 'write';
}

export function canWriteSection(
  user: Pick<User, 'role' | 'permissions'> | null | undefined,
  section: AsicSectionId,
  portal: AsicPortal,
): boolean {
  return getEffectiveSectionAccess(user, section, portal) === 'write';
}

export function canPerformAdminSections(user: Pick<User, 'role'> | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'branch_manager';
}
