import type { Branch, ICWarehouse, User } from '@/types';
import { findWarehouseByRouteParam } from '@/lib/icTransfer/warehouseSlug';

function opsRoleWarehouseShort(role: string): string | null {
  if (role.startsWith('warehouse_')) return role.slice('warehouse_'.length);
  if (role.startsWith('delivery_')) return role.slice('delivery_'.length);
  return null;
}

export function resolveWarehouseForUser(
  user: Pick<User, 'role' | 'warehouseId'>,
  warehouses: ICWarehouse[],
): ICWarehouse | undefined {
  if (user.warehouseId) {
    const byId = warehouses.find(w => w.id === user.warehouseId);
    if (byId) return byId;
  }
  const short = opsRoleWarehouseShort(user.role);
  if (!short) return undefined;
  return findWarehouseByRouteParam(warehouses, short);
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  auditor: 'Auditor',
  branch_manager: 'Branch manager',
  staff: 'Staff',
  customer: 'Customer',
  collection_agent: 'Collection agent',
  delivery: 'Delivery',
  investor: 'Investor',
};

export function formatGenericRoleLabel(role: string): string {
  if (ROLE_LABELS[role]) return ROLE_LABELS[role];
  if (role.startsWith('warehouse_')) return 'Warehouse';
  if (role.startsWith('delivery_')) return 'Delivery';
  return role.replace(/_/g, ' ');
}

/** Secondary line under the user name in the top bar. */
export function getUserTopbarSubtitle(
  user: User,
  warehouses: ICWarehouse[],
  branches: Branch[],
): string {
  const warehouse = resolveWarehouseForUser(user, warehouses);
  if (warehouse?.name?.trim()) return warehouse.name.trim();

  if (user.role.startsWith('warehouse_') || user.role.startsWith('delivery_')) {
    return 'Warehouse';
  }

  if (user.branchId) {
    const branch = branches.find(b => b.id === user.branchId);
    if (branch?.name?.trim()) return branch.name.trim();
  }

  return formatGenericRoleLabel(user.role);
}
