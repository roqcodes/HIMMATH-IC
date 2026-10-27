import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { loginPath, postLoginPath } from '@/lib/asic/routing';
import type { AsicPortal } from '@/lib/asic/routing';
import { isHqAdminStaff, isHqIcFundsBranchId } from '@/lib/icFunds/hqBranch';
import { isHqOperationsPortalSlug } from '@/lib/icTransfer/warehouseSlug';

export async function requirePortalUser(portal: AsicPortal, slug?: string) {
  const user = await getSessionUser(portal === 'admin' ? undefined : slug);
  if (!user) redirect(loginPath(slug, portal));

  const home = postLoginPath(user.role, user.role === 'admin' || user.role === 'auditor' ? undefined : slug);

  if (portal === 'admin') {
    if (user.role !== 'admin' && user.role !== 'auditor' && !isHqAdminStaff(user)) redirect(home);
    return user;
  }

  if (!slug) redirect(home);

  if (portal === 'branch') {
    if (user.role !== 'branch_manager' && user.role !== 'staff') redirect(home);
  } else if (portal === 'warehouse') {
    if (user.role === 'admin' || user.role === 'auditor') {
      redirect('/admin/warehouse');
    }
    if (!user.role.startsWith('warehouse_')) redirect(home);
    if (isHqOperationsPortalSlug(slug)) {
      if (user.branchId && !isHqIcFundsBranchId(user.branchId)) redirect(home);
    }
  } else if (portal === 'delivery') {
    if (!user.role.startsWith('delivery')) redirect(home);
    if (isHqOperationsPortalSlug(slug)) {
      if (user.branchId && !isHqIcFundsBranchId(user.branchId)) redirect(home);
    }
  } else if (portal === 'customer') {
    if (user.role !== 'customer') redirect(home);
  } else if (portal === 'collection') {
    if (user.role !== 'collection_agent') redirect(home);
    if (isHqOperationsPortalSlug(slug)) {
      if (user.branchId && !isHqIcFundsBranchId(user.branchId)) redirect(home);
    }
  }

  return user;
}
