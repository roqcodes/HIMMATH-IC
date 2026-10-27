import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { fetchCognitoUsersAction } from '@/app/actions/cognitoActions';
import WarehouseDetailsClient from '@/components/ic-transfer/warehouse/WarehouseDetailsClient';
import { requireICTransferBranchManager } from '@/lib/icTransfer/requireBranchPortalManager';
import { fetchWarehouseByRouteParam } from '@/lib/icTransfer/resolveWarehouse';
import { warehouseShortSlug } from '@/lib/icTransfer/warehouseSlug';

export default async function ICTransferBranchWarehouseDetailsPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id: routeParam } = await params;
  const { branchId } = await requireICTransferBranchManager(slug);

  const warehouse = await fetchWarehouseByRouteParam(routeParam);
  if (!warehouse || warehouse.branchId !== branchId) {
    notFound();
  }

  const canonicalSlug = warehouseShortSlug(warehouse.id);
  if (routeParam !== canonicalSlug) {
    redirect(`/branch/${slug}/warehouse/${canonicalSlug}`);
  }

  const shortWarehouseId = warehouse.id.slice(0, 8);
  const { success, data, error } = await fetchCognitoUsersAction(slug);
  const warehouseUsers =
    success && data
      ? data.filter(
          u =>
            u.role === `warehouse_${shortWarehouseId}` ||
            u.role === `delivery_${shortWarehouseId}`,
        )
      : [];

  return (
    <WarehouseDetailsClient
      branchSlug={slug}
      warehouseId={warehouse.id}
      initialUsers={warehouseUsers}
      usersError={error}
      portalMode="branch"
    />
  );
}
