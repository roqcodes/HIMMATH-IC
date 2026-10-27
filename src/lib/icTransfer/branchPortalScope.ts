import type { ICPurchase, ICRateGroup, ICSale, ICSupplier, ICWarehouse } from '@/types';
import { saleBelongsToBranchPortal } from '@/lib/icTransfer/branchOrderOwnership';
import { sectionHref } from '@/lib/asic/nav';
import { warehouseShortSlug } from '@/lib/icTransfer/warehouseSlug';

export type ICTransferPortalMode = 'admin' | 'branch';

export function getICTransferPortalBase(slug: string | undefined, mode: ICTransferPortalMode): string {
  if (mode === 'branch' && slug) return sectionHref('branch', 'orders', slug);
  return sectionHref('admin', 'sales');
}

export function getICTransferWarehouseBase(slug: string | undefined, mode: ICTransferPortalMode): string {
  if (mode === 'branch' && slug) return sectionHref('branch', 'warehouse', slug);
  return sectionHref('admin', 'warehouse');
}

export function getICTransferWarehouseDetailHref(
  slug: string | undefined,
  mode: ICTransferPortalMode,
  warehouseId: string,
): string {
  const shortId = warehouseShortSlug(warehouseId);
  if (mode === 'branch' && slug) {
    return `/branch/${slug}/warehouse/${shortId}`;
  }
  return `/admin/warehouse/${shortId}`;
}

/** Map IC Transfer admin URLs to branch-manager portal URLs (Orders / Warehouse / Rates). */
export function mapBranchManagerAdminRouteToPortal(slug: string, pathname: string): string {
  const adminPrefix = `/branch/${slug}/sales`;
  const portalBase = sectionHref('branch', 'orders', slug);

  if (!pathname.includes('ic-transfer-admin') && !pathname.includes('/admin/')) {
    return portalBase;
  }

  const normalized = pathname.replace(/\/$/, '');
  if (normalized.endsWith('/warehouse') || normalized.includes('/warehouse/')) {
    return sectionHref('branch', 'warehouse', slug);
  }
  if (normalized.endsWith('/purchase') || normalized.includes('/purchases')) {
    return sectionHref('branch', 'purchases', slug);
  }
  if (normalized.includes('/suppliers')) {
    return sectionHref('branch', 'suppliers', slug);
  }
  if (normalized.includes('/rates')) {
    return sectionHref('branch', 'rates', slug);
  }

  return portalBase;
}

export function filterWarehousesForBranchPortal(
  warehouses: ICWarehouse[],
  branchId: string,
): ICWarehouse[] {
  return warehouses.filter(w => w.branchId === branchId);
}

/** HQ admin warehouses only — excludes branch-owned warehouses. */
export function filterWarehousesForAdminPortal(
  warehouses: ICWarehouse[],
): ICWarehouse[] {
  return warehouses.filter(w => !w.branchId);
}

type AssignableWarehouseUser = {
  role?: string;
  branchId?: string;
};

/** Warehouses available when assigning on admin workflows (accept / reassign / edit sale). */
export function filterWarehousesForAssignableUser(
  warehouses: ICWarehouse[],
  user?: AssignableWarehouseUser | null,
): ICWarehouse[] {
  if (user?.role === 'branch_manager' && user.branchId) {
    return filterWarehousesForBranchPortal(warehouses, user.branchId);
  }
  return filterWarehousesForAdminPortal(warehouses);
}

export function filterSuppliersForBranchPortal(
  suppliers: ICSupplier[],
  branchId: string,
): ICSupplier[] {
  return suppliers.filter(s => s.branchId === branchId);
}

/** HQ admin suppliers only — excludes branch-owned suppliers. */
export function filterSuppliersForAdminPortal(suppliers: ICSupplier[]): ICSupplier[] {
  return suppliers.filter(s => !s.branchId);
}

/** Purchases restocking branch-owned warehouses only. */
export function filterPurchasesForBranchPortal(
  purchases: ICPurchase[],
  warehouses: ICWarehouse[],
  branchId: string,
): ICPurchase[] {
  const branchWarehouseIds = new Set(
    filterWarehousesForBranchPortal(warehouses, branchId).map(w => w.id),
  );
  return purchases.filter(
    p => !!p.warehouseId && branchWarehouseIds.has(p.warehouseId),
  );
}

export function filterRateGroupsForBranchPortal(
  groups: ICRateGroup[],
  _branchId: string,
  branchCustomerIds: Set<string>,
): ICRateGroup[] {
  return groups.filter(
    group => group.customerIds?.some(id => branchCustomerIds.has(id)) ?? false,
  );
}

export function mergeBranchPortalCustomerAssignments(
  existingCustomerIds: string[] | undefined,
  branchCustomerIds: Set<string>,
  assignedBranchCustomerIds: string[],
): string[] {
  const preserved =
    existingCustomerIds?.filter(id => !branchCustomerIds.has(id)) ?? [];
  return [...new Set([...preserved, ...assignedBranchCustomerIds])];
}

export function filterSalesForBranchPortal(
  sales: ICSale[],
  branchName: string,
  branchCustomerIds: Set<string>,
  branchCustomerNames?: Set<string>,
): ICSale[] {
  return sales.filter(sale =>
    saleBelongsToBranchPortal(sale, branchName, branchCustomerIds, branchCustomerNames),
  );
}

export function warehouseBelongsToBranch(
  warehouse: ICWarehouse | undefined,
  branchId: string,
): boolean {
  return !!warehouse && warehouse.branchId === branchId;
}

/** Country shown on the branch IC Transfer portal (falls back to location). */
export function resolveBranchPortalCountry(
  branch: { country?: string | null; location?: string | null } | null | undefined,
): string | undefined {
  const country = branch?.country?.trim();
  if (country) return country;
  const location = branch?.location?.trim();
  return location || undefined;
}

export function getBranchPortalDisplayName(
  branch: { name?: string | null; country?: string | null; location?: string | null } | null | undefined,
  fallback = 'IC Transfer',
): { title: string; subtitle?: string } {
  const name = branch?.name?.trim();
  if (!name) return { title: fallback };
  const country = resolveBranchPortalCountry(branch);
  return country ? { title: name, subtitle: country } : { title: name };
}
