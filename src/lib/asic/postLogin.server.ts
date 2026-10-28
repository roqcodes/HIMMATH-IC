import 'server-only';

import { query } from '@/lib/db';
import {
  HQ_OPERATIONS_PORTAL_SLUG,
  isHqOperationsPortalSlug,
} from '@/lib/icTransfer/warehouseSlug';
import { portalHome, RESERVED_BRANCH_SLUGS } from '@/lib/asic/routing';
import {
  HQ_IC_FUNDS_BRANCH_SLUG,
  isHqIcFundsBranchId,
} from '@/lib/icFunds/hqBranch';

async function branchSlugForUser(branchId?: string | null): Promise<string | null> {
  if (!branchId) return null;
  const res = await query(`SELECT slug FROM branches WHERE id = $1 LIMIT 1`, [branchId]);
  return res.rows[0]?.slug ? String(res.rows[0].slug) : null;
}

/** Role-aware landing page after authentication (server). */
export async function resolvePostLoginPath(
  role: string | undefined,
  loginSlug?: string,
  branchId?: string | null,
): Promise<string> {
  if (!role) return '/admin';
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'auditor') return '/admin/audit-log';
  if (role === 'staff' || role === 'branch_manager') return '/admin/dashboard';

  const sessionSlug =
    loginSlug && !RESERVED_BRANCH_SLUGS.has(loginSlug) && !isHqOperationsPortalSlug(loginSlug)
      ? loginSlug
      : null;
  const userBranchSlug = sessionSlug ?? (await branchSlugForUser(branchId));

  if (role.startsWith('delivery')) {
    return portalHome('delivery', userBranchSlug ?? HQ_OPERATIONS_PORTAL_SLUG);
  }

  if (role.startsWith('warehouse_')) {
    return portalHome('warehouse', userBranchSlug ?? HQ_OPERATIONS_PORTAL_SLUG);
  }

  if (!sessionSlug) {
    if (role === 'customer' && isHqIcFundsBranchId(branchId)) {
      return portalHome('customer', HQ_IC_FUNDS_BRANCH_SLUG);
    }
    return '/admin/dashboard';
  }

  if (role === 'customer') return portalHome('customer', sessionSlug);
  return '/admin/dashboard';
}
