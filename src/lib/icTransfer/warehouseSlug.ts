import type { ICWarehouse } from '@/types';
import { isHqIcFundsBranchId } from '@/lib/icFunds/hqBranch';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** SQL expression matching {@link warehouseShortSlug} for ic_warehouses.id (Postgres). */
export const WAREHOUSE_ROUTE_SLUG_SQL = `lower(substring(replace(id::text, '-', ''), 1, 8))`;

const SHORT_SLUG_RE = /^[0-9a-f]{8}$/;

export function isWarehouseRouteShortSlug(value: string): boolean {
  return SHORT_SLUG_RE.test(value.toLowerCase());
}

/** First 8 hex chars of the warehouse UUID (no dashes) — used in URLs and Cognito roles. */
export function warehouseShortSlug(warehouseId: string): string {
  return warehouseId.replace(/-/g, '').slice(0, 8).toLowerCase();
}

/** Warehouse id suffix embedded in `warehouse_*` / `delivery_*` profile roles. */
export function warehouseShortFromOpsRole(role: string): string | null {
  if (role.startsWith('warehouse_')) return role.slice('warehouse_'.length);
  if (role.startsWith('delivery_')) return role.slice('delivery_'.length);
  return null;
}

/** Login slug for HQ-owned warehouses and delivery agents (no branch assignment). */
export const HQ_OPERATIONS_PORTAL_SLUG = 'hq';

/** @deprecated Use HQ_OPERATIONS_PORTAL_SLUG */
export const HQ_WAREHOUSE_PORTAL_SLUG = HQ_OPERATIONS_PORTAL_SLUG;

export function isHqOperationsPortalSlug(slug?: string | null): boolean {
  return slug === HQ_OPERATIONS_PORTAL_SLUG;
}

/** HQ ops routes (`/warehouse/hq`, `/delivery/hq`) share the admin session cookie. */
export function authSessionSlug(slug?: string | null): string | undefined {
  if (!slug || slug === 'superadmin' || isHqOperationsPortalSlug(slug)) return undefined;
  return slug;
}

export function isHqOpsUser(user: { role: string; branchId?: string | null } | null | undefined): boolean {
  if (!user) return false;
  const isOpsRole = user.role.startsWith('warehouse_') || user.role.startsWith('delivery_');
  if (!isOpsRole) return false;
  return !user.branchId || isHqIcFundsBranchId(user.branchId);
}

/** @deprecated Use isHqOperationsPortalSlug */
export function isHqWarehousePortalSlug(slug?: string | null): boolean {
  return isHqOperationsPortalSlug(slug);
}

export function branchPortalSignInPath(branchSlug?: string | null): string {
  if (!branchSlug) return '/admin';
  return `/branch/${branchSlug}`;
}

/** @deprecated Use branchPortalSignInPath — all branch-scoped users share one login URL. */
export function warehousePortalLoginPath(branchSlug?: string | null): string {
  return branchPortalSignInPath(branchSlug);
}

/** @deprecated Use branchPortalSignInPath — all branch-scoped users share one login URL. */
export function deliveryPortalLoginPath(branchSlug?: string | null): string {
  return branchPortalSignInPath(branchSlug);
}

export function operationsPortalLoginPath(
  portal: 'warehouse' | 'delivery',
  branchSlug?: string | null,
): string {
  return portal === 'warehouse'
    ? warehousePortalLoginPath(branchSlug)
    : deliveryPortalLoginPath(branchSlug);
}

export function resolveOperationsPortalSlug(
  role: string | undefined,
  branchId?: string | null,
  sessionSlug?: string,
): string {
  if (sessionSlug && !isHqOperationsPortalSlug(sessionSlug)) return sessionSlug;
  if (branchId) return sessionSlug || HQ_OPERATIONS_PORTAL_SLUG;
  return HQ_OPERATIONS_PORTAL_SLUG;
}

export function isFullWarehouseUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function findWarehouseByRouteParam(
  warehouses: ICWarehouse[],
  param: string,
): ICWarehouse | undefined {
  if (!param) return undefined;
  if (isFullWarehouseUuid(param)) {
    return warehouses.find(w => w.id === param);
  }
  const slug = param.toLowerCase();
  return warehouses.find(w => warehouseShortSlug(w.id) === slug);
}

export function resolveWarehouseIdFromParam(
  warehouses: ICWarehouse[],
  param: string,
): string | null {
  return findWarehouseByRouteParam(warehouses, param)?.id ?? null;
}
