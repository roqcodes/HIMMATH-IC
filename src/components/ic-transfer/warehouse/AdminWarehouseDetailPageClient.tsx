'use client';

import React from 'react';
import WarehouseDetailsClient from '@/components/ic-transfer/warehouse/WarehouseDetailsClient';

type Props = {
  warehouseId: string;
};

export default function AdminWarehouseDetailPageClient({ warehouseId }: Props) {
  return (
    <WarehouseDetailsClient
      branchSlug=""
      warehouseId={warehouseId}
      portalMode="admin"
    />
  );
}
