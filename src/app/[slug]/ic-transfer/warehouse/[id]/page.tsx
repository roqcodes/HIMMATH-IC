import React from 'react';
import { redirect, notFound } from 'next/navigation';
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

  return (
    <WarehouseDetailsClient
      branchSlug={slug}
      warehouseId={warehouse.id}
      portalMode="branch"
    />
  );
}
