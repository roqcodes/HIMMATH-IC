'use client';

import React from 'react';
import BranchDetailsClient from '@/components/ic-transfer/branch/BranchDetailsClient';

type Props = {
  branchId: string;
};

export default function AdminBranchDetailPageClient({ branchId }: Props) {
  return <BranchDetailsClient branchSlug="" branchId={branchId} portalMode="admin" />;
}
