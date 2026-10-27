import 'server-only';
import { query } from '@/lib/db';
import { defaultStaffPermissions, migrateLegacyPermissionMap } from '@/lib/rbac';
import { HQ_IC_FUNDS_BRANCH_ID, isHqIcFundsBranchId } from '@/lib/icFunds/hqBranch';
import { defaultAdminStaffPermissions } from '@/lib/staffSectionPermissions';
import type { PageAccessLevel, PagePermissionMap } from '@/types';

export async function fetchUserPermissionsFromDb(
  userId: string,
  branchId: string,
): Promise<PagePermissionMap> {
  const res = await query(
    `SELECT page_id, access_level FROM user_page_permissions WHERE user_id = $1 AND branch_id = $2`,
    [userId, branchId],
  );

  const map: PagePermissionMap = {};
  for (const row of res.rows) {
    const level = row.access_level as PageAccessLevel;
    if (level === 'read' || level === 'write' || level === 'none') {
      map[row.page_id] = level;
    }
  }
  return migrateLegacyPermissionMap(map);
}

export async function fetchBranchHiddenPages(branchId: string): Promise<string[]> {
  const res = await query(`SELECT hidden_pages FROM branches WHERE id = $1 LIMIT 1`, [branchId]);
  const { normalizeHiddenPages } = await import('@/lib/branchPages');
  return normalizeHiddenPages((res.rows[0]?.hidden_pages as string[]) ?? []);
}

function permissionMapFromRows(rows: Array<{ page_id?: string; access_level?: string }>): PagePermissionMap {
  const map: PagePermissionMap = {};
  for (const row of rows) {
    const level = row.access_level as PageAccessLevel;
    if (level === 'read' || level === 'write' || level === 'none') {
      map[String(row.page_id)] = level;
    }
  }
  return migrateLegacyPermissionMap(map);
}

/** Permissions + hidden pages in one round trip. */
export async function fetchStaffAccessFromDb(
  userId: string,
  branchId: string,
): Promise<{ permissions: PagePermissionMap; hiddenPages: string[] }> {
  const res = await query(
    `SELECT
       (SELECT COALESCE(json_agg(json_build_object('page_id', page_id, 'access_level', access_level)), '[]'::json)
        FROM user_page_permissions WHERE user_id = $1 AND branch_id = $2) AS permissions,
       (SELECT hidden_pages FROM branches WHERE id = $2 LIMIT 1) AS hidden_pages`,
    [userId, branchId],
  );
  const { normalizeHiddenPages } = await import('@/lib/branchPages');
  const permRaw = res.rows[0]?.permissions;
  const permRows = Array.isArray(permRaw) ? permRaw : [];
  return {
    permissions: permissionMapFromRows(permRows as Array<{ page_id?: string; access_level?: string }>),
    hiddenPages: normalizeHiddenPages((res.rows[0]?.hidden_pages as string[]) ?? []),
  };
}

export async function upsertUserPermissions(
  userId: string,
  branchId: string,
  permissions: PagePermissionMap,
  updatedBy: string,
): Promise<void> {
  const entries = Object.entries(permissions).filter(
    ([, level]) => level === 'read' || level === 'write' || level === 'none',
  );
  if (entries.length === 0) return;

  const pageIds = entries.map(([pageId]) => pageId);
  const levels = entries.map(([, level]) => level);
  await query(
    `INSERT INTO user_page_permissions (user_id, branch_id, page_id, access_level, updated_by, updated_at)
     SELECT $1, $2, x.page_id, x.access_level, $3, CURRENT_TIMESTAMP
     FROM unnest($4::text[], $5::text[]) AS x(page_id, access_level)
     ON CONFLICT (user_id, branch_id, page_id)
     DO UPDATE SET access_level = EXCLUDED.access_level, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP`,
    [userId, branchId, updatedBy, pageIds, levels],
  );
}

export async function seedDefaultStaffPermissions(
  userId: string,
  branchId: string,
  updatedBy: string,
): Promise<void> {
  if (isHqIcFundsBranchId(branchId)) {
    await upsertUserPermissions(userId, branchId, defaultAdminStaffPermissions(), updatedBy);
    return;
  }
  const hiddenPages = await fetchBranchHiddenPages(branchId);
  const defaults = defaultStaffPermissions(hiddenPages);
  await upsertUserPermissions(userId, branchId, defaults, updatedBy);
}

export async function deleteUserPermissions(userId: string): Promise<void> {
  await query(`DELETE FROM user_page_permissions WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM user_deal_permissions WHERE user_id = $1`, [userId]);
}
