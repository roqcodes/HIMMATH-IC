import React from 'react';
import { requireICTransferBranchManager } from '@/lib/icTransfer/requireBranchPortalManager';
import CounterpartiesPage from '@/components/counterparties/CounterpartiesPage';

export default async function ICTransferBranchSuppliersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireICTransferBranchManager((await params).slug);
  return <CounterpartiesPage />;
}
