import { query } from '@/lib/db';
import type { PoolClient } from 'pg';

export async function fetchIcBranchManagerIds(icBranchId: string): Promise<string[]> {
  const res = await query<{ manager_id: string }>(
    `SELECT manager_id::text AS manager_id FROM ic_branch_managers WHERE branch_id = $1 ORDER BY manager_id`,
    [icBranchId],
  );
  return res.rows.map(r => String(r.manager_id));
}

export async function replaceIcBranchManagers(
  client: PoolClient,
  icBranchId: string,
  managerIds: string[],
): Promise<void> {
  await client.query(`DELETE FROM ic_branch_managers WHERE branch_id = $1`, [icBranchId]);
  const unique = [...new Set(managerIds.map(id => id.trim()).filter(Boolean))];
  for (const managerId of unique) {
    await client.query(
      `INSERT INTO ic_branch_managers (branch_id, manager_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [icBranchId, managerId],
    );
  }
}

/** Server guard: branch manager assignment + customer home manager. */
export async function assertManagerCustomerAllowedAtIcBranch(params: {
  icBranchId: string;
  managerId: string | null | undefined;
  customerId: string;
}): Promise<{ error: string } | null> {
  const icBranchId = params.icBranchId?.trim();
  const customerId = params.customerId?.trim();
  const managerId = params.managerId?.trim();
  if (!icBranchId || !customerId) return { error: 'Branch and customer are required.' };

  const [assigned, branchRes, custRes] = await Promise.all([
    fetchIcBranchManagerIds(icBranchId),
    query(`SELECT 1 FROM ic_branches WHERE id = $1 LIMIT 1`, [icBranchId]),
    query<{ home_manager_id: string | null; kind: string }>(
      `SELECT home_manager_id, kind FROM ic_counterparties WHERE id = $1 LIMIT 1`,
      [customerId],
    ),
  ]);

  if (branchRes.rows.length === 0) return { error: 'Branch not found.' };
  if (custRes.rows.length === 0) return { error: 'Customer not found.' };
  if (String(custRes.rows[0].kind) !== 'customer') {
    return { error: 'Select a customer counterparty.' };
  }

  const homeManagerId = custRes.rows[0].home_manager_id ? String(custRes.rows[0].home_manager_id) : null;

  if (assigned.length === 0) {
    return { error: 'Assign at least one manager to this branch before recording deposits.' };
  }

  if (!managerId) {
    return { error: 'Manager is required for this branch.' };
  }
  if (!assigned.includes(managerId)) {
    return { error: 'This manager is not assigned to the selected branch.' };
  }
  if (!homeManagerId || homeManagerId !== managerId) {
    return { error: 'Customer does not belong to this manager.' };
  }

  return null;
}
