'use client';

import React from 'react';
import ASICToolbar from '@/components/asic/ASICToolbar';
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
    <div className="flex min-h-0 flex-1 flex-col">
      <ASICToolbar portal="admin" section="warehouse" />
      <div className="min-w-0 flex-1 px-1 py-1 sm:px-2 sm:py-2">
        <WarehouseDetailsClient
          branchSlug=""
          warehouseId={warehouseId}
          initialUsers={initialUsers}
          usersError={usersError}
          portalMode="admin"
        />
      </div>
    </div>
  );
}
