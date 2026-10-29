import 'server-only';

import { query } from '@/lib/db';
import type { User } from '@/types';
import { warehouseShortFromOpsRole } from '@/lib/icTransfer/warehouseSlug';

function isOpsPortalRole(role: string): boolean {
  return role.startsWith('warehouse_') || role.startsWith('delivery_') || role === 'delivery';
}

/** Ensures warehouse portal users carry `warehouseId` (from profile, agent row, or role suffix). */
export async function loadOpsUserScope(user: User): Promise<User> {
  if (!isOpsPortalRole(user.role)) return user;
  if (user.warehouseId) return user;

  try {
    const byEmail = await query(
      `SELECT warehouse_id::text AS warehouse_id
       FROM ic_delivery_agents
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [user.email],
    );
    const fromAgent = byEmail.rows[0]?.warehouse_id;
    if (fromAgent) {
      return { ...user, warehouseId: String(fromAgent) };
    }

    const short = warehouseShortFromOpsRole(user.role);
    if (short) {
      const byShort = await query(
        `SELECT id::text AS id
         FROM ic_warehouses
         WHERE lower(substring(replace(id::text, '-', ''), 1, 8)) = lower($1)
         LIMIT 1`,
        [short],
      );
      const id = byShort.rows[0]?.id;
      if (id) {
        return { ...user, warehouseId: String(id) };
      }
    }
  } catch {
    return user;
  }

  return user;
}
