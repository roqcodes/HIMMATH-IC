'use client';

import React from 'react';
import WarehouseDetailsClient from '@/components/ic-transfer/warehouse/WarehouseDetailsClient';
import type { CognitoUser } from '@/app/actions/cognitoActions';

type Props = {
  warehouseId: string;
  initialUsers: CognitoUser[];
  usersError?: string;
};

export default function AdminWarehouseDetailPageClient({
  warehouseId,
  initialUsers,
  usersError,
}: Props) {
  return (
    <WarehouseDetailsClient
      branchSlug=""
      warehouseId={warehouseId}
      initialUsers={initialUsers}
      usersError={usersError}
      portalMode="admin"
    />
  );
}
