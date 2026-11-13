import { query } from '@/lib/db';
import type { PoolClient } from 'pg';

export async function fetchWarehouseManagerIds(warehouseId: string): Promise<string[]> {
  const res = await query<{ manager_id: string }>(
    `SELECT manager_id::text AS manager_id FROM ic_warehouse_managers WHERE warehouse_id = $1 ORDER BY manager_id`,
    [warehouseId],
  );
  return res.rows.map(r => String(r.manager_id));
}

export async function replaceWarehouseManagers(
  client: PoolClient,
  warehouseId: string,
  managerIds: string[],
): Promise<void> {
  await client.query(`DELETE FROM ic_warehouse_managers WHERE warehouse_id = $1`, [warehouseId]);
  const unique = [...new Set(managerIds.map(id => id.trim()).filter(Boolean))];
  for (const managerId of unique) {
    await client.query(
      `INSERT INTO ic_warehouse_managers (warehouse_id, manager_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [warehouseId, managerId],
    );
  }
}

async function loadWarehouseDeskKind(warehouseId: string): Promise<'warehouse' | 'branch' | null> {
  const res = await query<{ desk_kind: string }>(
    `SELECT desk_kind FROM ic_warehouses WHERE id = $1 LIMIT 1`,
    [warehouseId],
  );
  if (res.rows.length === 0) return null;
  return res.rows[0].desk_kind === 'branch' ? 'branch' : 'warehouse';
}

/** Server guard: warehouse assignment + customer home manager. */
export async function assertManagerCustomerAllowedAtWarehouse(params: {
  warehouseId: string;
  managerId: string | null | undefined;
  customerId: string;
}): Promise<{ error: string } | null> {
  const warehouseId = params.warehouseId?.trim();
  const customerId = params.customerId?.trim();
  const managerId = params.managerId?.trim();
  if (!warehouseId || !customerId) return { error: 'Warehouse and customer are required.' };

  const [assigned, deskKind, custRes] = await Promise.all([
    fetchWarehouseManagerIds(warehouseId),
    loadWarehouseDeskKind(warehouseId),
    query<{ home_manager_id: string | null; kind: string }>(
      `SELECT home_manager_id, kind FROM ic_counterparties WHERE id = $1 LIMIT 1`,
      [customerId],
    ),
  ]);

  if (custRes.rows.length === 0) return { error: 'Customer not found.' };
  if (String(custRes.rows[0].kind) !== 'customer') {
    return { error: 'Select a customer counterparty.' };
  }

  const homeManagerId = custRes.rows[0].home_manager_id ? String(custRes.rows[0].home_manager_id) : null;

  if (deskKind === 'branch' && assigned.length === 0) {
    return { error: 'Assign at least one manager to this branch before recording deposits.' };
  }

  if (assigned.length === 0) {
    if (!managerId) return null;
    if (homeManagerId && homeManagerId !== managerId) {
      return { error: 'Customer does not belong to this manager.' };
    }
    return null;
  }

  if (!managerId) {
    return { error: 'Manager is required for this warehouse.' };
  }
  if (!assigned.includes(managerId)) {
    return { error: 'This manager is not assigned to the selected warehouse.' };
  }
  if (!homeManagerId || homeManagerId !== managerId) {
    return { error: 'Customer does not belong to this manager.' };
  }

  return null;
}
