'use server';

import { z } from 'zod';
import { query, pool } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';
import { resolveBranchTimeZone, DEFAULT_BRANCH_TIMEZONE } from '@/lib/businessTime';
import { isHqIcFundsBranch } from '@/lib/icFunds/hqBranch';
import { logger } from '@/lib/logger';
import { createCognitoUserAction } from '@/app/actions/cognitoActions';
import { PASSWORD_INVALID_MESSAGE, validatePassword } from '@/lib/passwordValidation';
import { revalidatePath } from 'next/cache';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}

export type BranchRow = {
  id: string;
  slug: string;
  name: string;
  location: string;
  managerName: string;
  timezone: string;
  status: 'active' | 'inactive';
  isActive: boolean;
  features: { warehousePortal: boolean; customerPortal: boolean };
  createdAt: string;
};

function mapBranch(r: Record<string, unknown>): BranchRow {
  const featuresRaw = r.features as { warehousePortal?: boolean; customerPortal?: boolean } | null;
  return {
    id: String(r.id),
    slug: String(r.slug || ''),
    name: String(r.name),
    location: String(r.location || ''),
    managerName: String(r.manager_name || ''),
    timezone: resolveBranchTimeZone(r.timezone ? String(r.timezone) : null),
    status: r.status === 'inactive' ? 'inactive' : 'active',
    isActive: r.is_active !== false && r.status !== 'inactive' && !r.deleted_at,
    features: {
      warehousePortal: featuresRaw?.warehousePortal !== false,
      customerPortal: featuresRaw?.customerPortal !== false,
    },
    createdAt: r.created_at ? new Date(String(r.created_at)).toISOString() : new Date().toISOString(),
  };
}

export async function listBranchesAction(): Promise<
  { success: true; data: BranchRow[] } | { success: false; error: string }
> {
  const user = await requireAdmin();
  if (!user) return { success: false, error: 'Admin access required.' };
  try {
    const res = await query(
      `SELECT id, slug, name, location, manager_name, timezone, status, is_active, features, deleted_at, created_at
       FROM branches
       WHERE deleted_at IS NULL
       ORDER BY name ASC`,
    );
    return { success: true, data: res.rows.map(mapBranch).filter(b => !isHqIcFundsBranch(b)) };
  } catch (error) {
    logger.error({ error }, 'listBranchesAction failed');
    return { success: false, error: 'Failed to load branches.' };
  }
}

export async function getBranchBySlugAction(
  slug: string,
): Promise<{ success: true; data: BranchRow } | { success: false; error: string }> {
  const user = await requireAdmin();
  if (!user) return { success: false, error: 'Admin access required.' };
  try {
    const res = await query(
      `SELECT id, slug, name, location, manager_name, timezone, status, is_active, features, deleted_at, created_at
       FROM branches
       WHERE slug = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [slug],
    );
    if (res.rows.length === 0) return { success: false, error: 'Branch not found.' };
    const branch = mapBranch(res.rows[0]);
    if (isHqIcFundsBranch(branch)) return { success: false, error: 'Branch not found.' };
    return { success: true, data: branch };
  } catch (error) {
    logger.error({ error, slug }, 'getBranchBySlugAction failed');
    return { success: false, error: 'Failed to load branch.' };
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  location: z.string().min(1),
  timezone: z.string().min(1).default(DEFAULT_BRANCH_TIMEZONE),
  managerName: z.string().optional(),
  managerEmail: z.string().email().optional().or(z.literal('')),
  managerPassword: z.string().optional().or(z.literal('')),
  warehousePortal: z.boolean().default(true),
  customerPortal: z.boolean().default(true),
});

export async function createBranchAction(
  input: z.infer<typeof createSchema>,
): Promise<{ success: true; data: BranchRow } | { success: false; error: string }> {
  const user = await requireAdmin();
  if (!user) return { success: false, error: 'Admin access required.' };

  const parsed = createSchema.safeParse({
    ...input,
    slug: input.slug || slugify(input.name),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map(i => i.message).join(', ') };
  }
  const data = parsed.data;
  const id = `BR${Date.now().toString(36).toUpperCase()}`;
  const now = new Date().toISOString();
  const managerName = data.managerName?.trim() || 'Unassigned';
  const features = {
    warehousePortal: data.warehousePortal,
    customerPortal: data.customerPortal,
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO branches (
         id, slug, name, location, manager_name, cash_balance, gold_balance, current_balance,
         opening_balance, opening_gold_balance, closing_balance, daily_pl, status, timezone,
         hidden_pages, features, is_active, last_activity, created_at
       ) VALUES ($1,$2,$3,$4,$5,0,0,0,0,0,0,0,'active',$6,'{}',$7::jsonb,true,$8,$8)`,
      [id, data.slug, data.name.trim(), data.location.trim(), managerName, data.timezone, JSON.stringify(features), now],
    );
    await client.query('COMMIT');
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : 'Failed to create branch.';
    logger.error({ error }, 'createBranchAction failed');
    return { success: false, error: message.includes('duplicate') ? 'Slug or name already exists.' : message };
  } finally {
    client.release();
  }

  if (data.managerEmail && data.managerPassword && data.managerName) {
    if (!validatePassword(data.managerPassword).isValid) {
      return { success: false, error: PASSWORD_INVALID_MESSAGE };
    }
    const userRes = await createCognitoUserAction(
      data.managerEmail,
      data.managerName,
      'branch_manager',
      id,
      data.managerPassword,
    );
    if (!userRes.success) {
      logger.warn({ error: userRes.error, branchId: id }, 'Branch created but manager account failed');
    }
  }

  await writeAuditLog({
    actor: user,
    action: 'create',
    entityType: 'branch',
    entityId: id,
    branchId: id,
    after: { slug: data.slug, name: data.name },
  });
  revalidatePath('/admin/branches');
  revalidatePath(`/admin/branches/${data.slug}`);
  const created: BranchRow = {
    id,
    slug: data.slug,
    name: data.name.trim(),
    location: data.location.trim(),
    managerName,
    timezone: data.timezone,
    status: 'active',
    isActive: true,
    features,
    createdAt: now,
  };
  return { success: true, data: created };
}

export async function updateBranchAction(input: {
  id: string;
  name: string;
  location: string;
  timezone: string;
  managerName: string;
  isActive: boolean;
  warehousePortal: boolean;
  customerPortal: boolean;
}): Promise<{ success: true } | { success: false; error: string }> {
  const user = await requireAdmin();
  if (!user) return { success: false, error: 'Admin access required.' };
  try {
    const slugRes = await query(`SELECT slug FROM branches WHERE id = $1 LIMIT 1`, [input.id]);
    const branchSlug = slugRes.rows[0]?.slug ? String(slugRes.rows[0].slug) : null;

    await query(
      `UPDATE branches
       SET name = $2, location = $3, timezone = $4, manager_name = $5,
           is_active = $6, status = $7,
           features = $8::jsonb,
           last_activity = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL`,
      [
        input.id,
        input.name.trim(),
        input.location.trim(),
        input.timezone,
        input.managerName.trim(),
        input.isActive,
        input.isActive ? 'active' : 'inactive',
        JSON.stringify({ warehousePortal: input.warehousePortal, customerPortal: input.customerPortal }),
      ],
    );
    await writeAuditLog({
      actor: user,
      action: 'update',
      entityType: 'branch',
      entityId: input.id,
      branchId: input.id,
      after: input,
    });
    revalidatePath('/admin/branches');
    if (branchSlug) revalidatePath(`/admin/branches/${branchSlug}`);
    return { success: true };
  } catch (error) {
    logger.error({ error, id: input.id }, 'updateBranchAction failed');
    return { success: false, error: 'Failed to update branch.' };
  }
}

export async function softDeleteBranchAction(
  id: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await requireAdmin();
  if (!user) return { success: false, error: 'Admin access required.' };
  if (isHqIcFundsBranch({ id, slug: '' })) {
    return { success: false, error: 'The HQ ledger cannot be deactivated.' };
  }
  try {
    const slugRes = await query(`SELECT slug FROM branches WHERE id = $1 LIMIT 1`, [id]);
    const branchSlug = slugRes.rows[0]?.slug ? String(slugRes.rows[0].slug) : null;

    await query(
      `UPDATE branches SET deleted_at = CURRENT_TIMESTAMP, is_active = false, status = 'inactive'
       WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    await writeAuditLog({
      actor: user,
      action: 'delete',
      entityType: 'branch',
      entityId: id,
      branchId: id,
    });
    revalidatePath('/admin/branches');
    if (branchSlug) revalidatePath(`/admin/branches/${branchSlug}`);
    return { success: true };
  } catch (error) {
    logger.error({ error, id }, 'softDeleteBranchAction failed');
    return { success: false, error: 'Failed to deactivate branch.' };
  }
}

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
