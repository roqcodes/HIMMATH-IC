import type { Branch, ICPurchase, ICSale, ICRateGroup, ICWarehouse, User, ICSupplier } from '@/types';
import { HQ_IC_FUNDS_BRANCH_ID } from '@/lib/icFunds/hqBranch';
import { warehouseShortSlug } from '@/lib/icTransfer/warehouseSlug';
import {
  filterCounterpartiesByKind,
  filterCounterpartiesByRole,
  filterCustomersUnderManager,
} from '@/lib/counterparties/roles';

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

function scopeCounterparties<T extends ICSupplier>(
  list: T[],
  branchId?: string,
): T[] {
  return branchId ? filterSuppliersForBranchPortal(list, branchId) : filterSuppliersForAdminPortal(list);
}

export function filterCounterpartiesForManagers<T extends ICSupplier>(
  list: T[],
  branchId?: string,
  allowedManagerIds?: string[] | null,
): T[] {
  let managers = filterCounterpartiesByKind(scopeCounterparties(list, branchId), 'manager');
  if (allowedManagerIds && allowedManagerIds.length > 0) {
    const allowed = new Set(allowedManagerIds);
    managers = managers.filter(m => allowed.has(m.id));
  }
  return managers;
}

export function filterCounterpartiesForPurchase<T extends ICSupplier>(
  list: T[],
  branchId?: string,
  managerId?: string,
): T[] {
  const base = filterCounterpartiesByRole(
    filterCounterpartiesByKind(scopeCounterparties(list, branchId), 'customer'),
    'supplier',
  );
  return managerId ? filterCustomersUnderManager(base, managerId) : base;
}

export function filterCounterpartiesForSales<T extends ICSupplier>(
  list: T[],
  branchId?: string,
  managerId?: string,
): T[] {
  const base = filterCounterpartiesByRole(
    filterCounterpartiesByKind(scopeCounterparties(list, branchId), 'customer'),
    'party',
  );
  return managerId ? filterCustomersUnderManager(base, managerId) : base;
}

export function isBranchDeskWarehouse(warehouse: Pick<ICWarehouse, 'deskKind'>): boolean {
  return warehouse.deskKind === 'branch';
}

export function filterBranchDesks(warehouses: ICWarehouse[]): ICWarehouse[] {
  return warehouses.filter(isBranchDeskWarehouse);
}

export function filterIndiaWarehouses(warehouses: ICWarehouse[]): ICWarehouse[] {
  return warehouses.filter(w => !isBranchDeskWarehouse(w));
}

export function filterCounterpartiesForAgent<T extends ICSupplier>(
  list: T[],
  branchId?: string,
): T[] {
  return filterCounterpartiesByRole(scopeCounterparties(list, branchId), 'agent');
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
  slug?: string,
): string {
  if (portal === 'branch' && slug) {
    return `/${slug}/ic-transfer-admin/warehouse`;
  }
  return '/admin/warehouse';
}

export function getICTransferBranchBase(
  portal: ICTransferPortalMode = 'admin',
  slug?: string,
): string {
  if (portal === 'branch' && slug) {
    return `/${slug}/ic-transfer-admin/branches`;
  }
  return '/admin/branches';
}

export function getICTransferBranchDetailHref(
  slug: string,
  warehouseId: string,
  portal: ICTransferPortalMode = 'admin',
): string {
  const id = warehouseShortSlug(warehouseId);
  if (portal === 'branch' && slug) {
    return `/${slug}/ic-transfer-admin/branches/${id}`;
  }
  return `/admin/branches/${id}`;
}

export function getICTransferWarehouseDetailHref(
  slug: string,
  warehouseId: string,
  portal: ICTransferPortalMode = 'admin',
): string {
  const id = warehouseShortSlug(warehouseId);
  if (portal === 'branch' && slug) {
    return `/${slug}/ic-transfer-admin/warehouse/${id}`;
  }
  return `/admin/warehouse/${id}`;
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
  return '/admin/customers';
}

export function filterBranchesForUserManagement(branches: Branch[]): Branch[] {
  return branches.filter(b => b.id === HQ_IC_FUNDS_BRANCH_ID);
}

export function shouldShowBranchPicker(_isAdmin: boolean): boolean {
  return false;
}
