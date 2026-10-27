import React from 'react';
import { getSessionUser } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { fetchCognitoUsersAction } from '@/app/actions/cognitoActions';
import WarehouseDetailsClient from '@/components/ic-transfer/warehouse/WarehouseDetailsClient';
import { isBranchPortalRole } from '@/lib/rbac';
import { fetchWarehouseByRouteParam } from '@/lib/icTransfer/resolveWarehouse';
import { warehouseShortSlug } from '@/lib/icTransfer/warehouseSlug';

export default async function WarehouseDetailsPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id: routeParam } = await params;

  const user = await getSessionUser(slug);
  if (!user || !isBranchPortalRole(user.role)) {
    redirect(`/${slug}`);
  }

  const canManage = user.role === 'branch_manager' || user.role === 'admin';
  if (!canManage) {
    redirect(`/${slug}/ic-transfer-admin/warehouse`);
  }

  const warehouse = await fetchWarehouseByRouteParam(routeParam);
  if (!warehouse) {
    notFound();
  }

  const canonicalSlug = warehouseShortSlug(warehouse.id);
  if (routeParam !== canonicalSlug) {
    redirect(`/${slug}/ic-transfer-admin/warehouse/${canonicalSlug}`);
  }

  const shortWarehouseId = warehouse.id.slice(0, 8);
  const { success, data, error } = await fetchCognitoUsersAction(slug);
  const warehouseUsers =
    success && data
      ? data.filter(u => u.role === `warehouse_${shortWarehouseId}` || u.role === `delivery_${shortWarehouseId}`)
      : [];

  return (
    <WarehouseDetailsClient
      branchSlug={slug}
      warehouseId={warehouse.id}
      initialUsers={warehouseUsers}
      usersError={error}
    />
  );
}
