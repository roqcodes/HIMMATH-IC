import { redirect, notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { fetchWarehouseByRouteParam } from '@/lib/icTransfer/resolveWarehouse';
import { warehouseShortSlug } from '@/lib/icTransfer/warehouseSlug';

/** Legacy URL → canonical HQ admin warehouse detail (KPIs + user management). */
export default async function LegacyWarehouseDetailsPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id: routeParam } = await params;
  const user = await getSessionUser(slug);
  if (!user) {
    redirect('/admin');
  }

  const warehouse = await fetchWarehouseByRouteParam(routeParam);
  if (!warehouse) {
    notFound();
  }

  redirect(`/admin/warehouse/${warehouseShortSlug(warehouse.id)}`);
}
