'use server';

import { query } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';
import { logger } from '@/lib/logger';

export async function listAuditLogAction(input?: {
  branchId?: string;
  limit?: number;
  offset?: number;
}): Promise<
  | {
      success: true;
      data: {
        id: string;
        createdAt: string;
        actorEmail: string | null;
        actorRole: string | null;
        action: string;
        entityType: string;
        entityId: string | null;
        branchId: string | null;
      }[];
      total: number;
    }
  | { success: false; error: string }
> {
  const user = await getSessionUser();
  if (!user || (user.role !== 'admin' && user.role !== 'auditor' && user.role !== 'branch_manager')) {
    return { success: false, error: 'Access denied.' };
  }
  const limit = Math.min(input?.limit ?? 50, 200);
  const offset = input?.offset ?? 0;
  const branchFilter =
    user.role === 'branch_manager' ? user.branchId : input?.branchId || null;
  try {
    const countRes = await query(
      `SELECT COUNT(*)::int AS n FROM audit_log WHERE ($1::text IS NULL OR branch_id = $1)`,
      [branchFilter],
    );
    const res = await query(
      `SELECT id, created_at, actor_email, actor_role, action, entity_type, entity_id, branch_id
       FROM audit_log
       WHERE ($1::text IS NULL OR branch_id = $1)
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [branchFilter, limit, offset],
    );
    return {
      success: true,
      total: countRes.rows[0]?.n ?? 0,
      data: res.rows.map(r => ({
        id: String(r.id),
        createdAt: new Date(r.created_at).toISOString(),
        actorEmail: r.actor_email ? String(r.actor_email) : null,
        actorRole: r.actor_role ? String(r.actor_role) : null,
        action: String(r.action),
        entityType: String(r.entity_type),
        entityId: r.entity_id ? String(r.entity_id) : null,
        branchId: r.branch_id ? String(r.branch_id) : null,
      })),
    };
  } catch (error) {
    logger.error({ error }, 'listAuditLogAction failed');
    return { success: false, error: 'Failed to load audit log.' };
  }
}

export async function logExportAction(entityType: string, branchId?: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  await writeAuditLog({
    actor: user,
    action: 'export',
    entityType,
    branchId: branchId ?? user.branchId ?? null,
  });
}

export async function fetchReconciliationAction(): Promise<
  | {
      success: true;
      data: {
        branchId: string;
        branchName: string;
        fundBalance: number;
        openOrders: number;
        completedOrders: number;
        warehouseCount: number;
      }[];
    }
  | { success: false; error: string }
> {
  const user = await getSessionUser();
  if (!user || (user.role !== 'admin' && user.role !== 'auditor' && user.role !== 'branch_manager')) {
    return { success: false, error: 'Access denied.' };
  }
  try {
    const res = await query(
      `SELECT b.id, b.name,
        COALESCE((
          SELECT SUM(a.opening_balance) FROM ic_fund_accounts a
          WHERE a.branch_id = b.id AND a.status = 'active'
        ), 0) AS fund_balance,
        COALESCE((
          SELECT COUNT(*) FROM ic_sales s
          LEFT JOIN ic_warehouses w ON w.id = s.warehouse_id
          WHERE (w.branch_id = b.id OR s.entered_by_user_id IS NOT NULL)
            AND s.order_status NOT IN ('completed','cancelled','rejected')
        ), 0)::int AS open_orders,
        COALESCE((
          SELECT COUNT(*) FROM ic_sales s
          LEFT JOIN ic_warehouses w ON w.id = s.warehouse_id
          WHERE w.branch_id = b.id AND s.order_status = 'completed'
        ), 0)::int AS completed_orders,
        COALESCE((SELECT COUNT(*) FROM ic_warehouses w WHERE w.branch_id = b.id OR w.branch_id IS NULL), 0)::int AS warehouse_count
       FROM branches b
       WHERE b.deleted_at IS NULL
         AND ($1::text IS NULL OR b.id = $1)
       ORDER BY b.name`,
      [user.role === 'branch_manager' ? user.branchId : null],
    );
    return {
      success: true,
      data: res.rows.map(r => ({
        branchId: String(r.id),
        branchName: String(r.name),
        fundBalance: parseFloat(String(r.fund_balance || 0)),
        openOrders: Number(r.open_orders || 0),
        completedOrders: Number(r.completed_orders || 0),
        warehouseCount: Number(r.warehouse_count || 0),
      })),
    };
  } catch (error) {
    logger.error({ error }, 'fetchReconciliationAction failed');
    return { success: false, error: 'Failed to load reconciliation.' };
  }
}
