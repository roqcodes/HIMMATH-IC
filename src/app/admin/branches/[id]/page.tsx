import { redirect, notFound } from 'next/navigation';
import AdminBranchDetailPageClient from '@/components/ic-transfer/warehouse/AdminBranchDetailPageClient';
import { requirePortalUser } from '@/lib/asic/guards';
import { fetchIcBranchByRouteParam } from '@/lib/icTransfer/resolveIcBranch';
import { warehouseShortSlug } from '@/lib/icTransfer/warehouseSlug';

export default async function AdminBranchDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePortalUser('admin');
  const { id: routeParam } = await params;

  const canManage = user.role === 'admin' || user.role === 'auditor';
  if (!canManage) {
    redirect('/admin/branches');
  }

  const branch = await fetchIcBranchByRouteParam(routeParam);
  if (!branch) {
    notFound();
  }

  const canonicalSlug = warehouseShortSlug(branch.id);
  if (routeParam !== canonicalSlug) {
    redirect(`/admin/branches/${canonicalSlug}`);
  }

  return <AdminBranchDetailPageClient branchId={branch.id} />;
}
