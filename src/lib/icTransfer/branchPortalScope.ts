import type { Branch, ICPurchase, ICSale, ICRateGroup, ICWarehouse, User } from '@/types';
import { HQ_IC_FUNDS_BRANCH_ID } from '@/lib/icFunds/hqBranch';

export type ICTransferPortalMode = 'admin' | 'branch';

/** HQ-only: admin portal always uses HQ ledger context. */
export function isAdminPortalMode(_portal?: string): boolean {
  return true;
}

export function isBranchPortalMode(_portal?: string): boolean {
  return false;
}

export function getBranchPortalDisplayName(
  branch: { name?: string | null; country?: string | null; location?: string | null } | null | undefined,
  fallback = 'HQ',
): { title: string; subtitle?: string } {
  const title = branch?.name?.trim() || fallback;
  const subtitle = branch?.location?.trim() || branch?.country?.trim() || undefined;
  return subtitle ? { title, subtitle } : { title };
}

export function filterWarehousesForAdminPortal(warehouses: ICWarehouse[]): ICWarehouse[] {
  return warehouses.filter(w => !w.branchId || w.branchId === HQ_IC_FUNDS_BRANCH_ID);
}

export function filterWarehousesForBranchPortal(
  warehouses: ICWarehouse[],
  _branchId?: string,
): ICWarehouse[] {
  return filterWarehousesForAdminPortal(warehouses);
}

export function filterWarehousesForAssignableUser(
  warehouses: ICWarehouse[],
  _user: User | null | undefined,
): ICWarehouse[] {
  return filterWarehousesForAdminPortal(warehouses);
}

export function filterSuppliersForAdminPortal<T extends { branchId?: string | null }>(suppliers: T[]): T[] {
  return suppliers.filter(s => !s.branchId || s.branchId === HQ_IC_FUNDS_BRANCH_ID);
}

export function filterSuppliersForBranchPortal<T extends { branchId?: string | null }>(
  suppliers: T[],
  _branchId?: string,
): T[] {
  return filterSuppliersForAdminPortal(suppliers);
}

export function filterPurchasesForBranchPortal(
  purchases: ICPurchase[],
  warehouses: ICWarehouse[],
  _branchId?: string,
): ICPurchase[] {
  const allowed = new Set(filterWarehousesForBranchPortal(warehouses).map(w => w.id));
  return purchases.filter(p => !p.warehouseId || allowed.has(p.warehouseId));
}

export function filterSalesForBranchPortal(
  sales: ICSale[],
  _branchName?: string,
  _branchCustomerIds?: Set<string>,
): ICSale[] {
  return sales;
}

export function mergeBranchPortalCustomerAssignments(
  existingIds: string[] | undefined,
  branchCustomerIds: Set<string>,
  nextIds: string[],
): string[] {
  const merged = new Set(existingIds ?? []);
  for (const id of nextIds) {
    if (branchCustomerIds.has(id)) merged.add(id);
  }
  return [...merged];
}

export function getICTransferWarehouseBase(
  portal: ICTransferPortalMode = 'admin',
  _slug?: string,
): string {
  return portal === 'branch' ? '/branch/ic-transfer/warehouse' : '/admin/ic-transfer/warehouse';
}

export function getICTransferWarehouseDetailHref(
  slug: string,
  warehouseId: string,
  portal: ICTransferPortalMode = 'admin',
): string {
  const base = getICTransferWarehouseBase(portal, slug);
  return `${base}/${warehouseId}`;
}

export function resolvePortalBranchId(_branchSlug?: string | null): string {
  return HQ_IC_FUNDS_BRANCH_ID;
}

export function saleBelongsToBranchPortal(_sale: ICSale, _branchId?: string): boolean {
  return false;
}

export function mapBranchPortalUrl(_path: string): string {
  return '/admin/dashboard';
}

export function branchPortalCustomersPath(_slug: string): string {
  return '/admin/entities';
}

export function filterBranchesForUserManagement(branches: Branch[]): Branch[] {
  return branches.filter(b => b.id === HQ_IC_FUNDS_BRANCH_ID);
}

export function shouldShowBranchPicker(_isAdmin: boolean): boolean {
  return false;
}
