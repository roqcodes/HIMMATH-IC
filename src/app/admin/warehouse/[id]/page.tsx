import { redirect, notFound } from 'next/navigation';
import AdminWarehouseDetailPageClient from '@/components/ic-transfer/warehouse/AdminWarehouseDetailPageClient';
import { requirePortalUser } from '@/lib/asic/guards';
import { fetchWarehouseByRouteParam } from '@/lib/icTransfer/resolveWarehouse';
import { warehouseShortSlug } from '@/lib/icTransfer/warehouseSlug';

export default async function AdminWarehouseDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePortalUser('admin');
  const { id: routeParam } = await params;

  const canManage = user.role === 'admin' || user.role === 'auditor';
  if (!canManage) {
    redirect('/admin/warehouse');
  }

  const warehouse = await fetchWarehouseByRouteParam(routeParam);
  if (!warehouse) {
    notFound();
  }

  const canonicalSlug = warehouseShortSlug(warehouse.id);
  if (routeParam !== canonicalSlug) {
    redirect(`/admin/warehouse/${canonicalSlug}`);
  }

  return <AdminWarehouseDetailPageClient warehouseId={warehouse.id} />;
}
