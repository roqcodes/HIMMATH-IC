import React from 'react';
import { redirect, notFound } from 'next/navigation';
import CounterpartyDetailsClient from '@/components/counterparties/CounterpartyDetailsClient';
import { requireICTransferBranchManager } from '@/lib/icTransfer/requireBranchPortalManager';
import { fetchCounterpartyByRouteParam } from '@/lib/counterparties/resolveCounterparty';
import { counterpartyShortSlug } from '@/lib/counterparties/counterpartySlug';

export default async function BranchCounterpartyDetailsPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id: routeParam } = await params;
  const { branchId } = await requireICTransferBranchManager(slug);

  const counterparty = await fetchCounterpartyByRouteParam(routeParam);
  if (!counterparty || (counterparty.branchId && counterparty.branchId !== branchId)) {
    notFound();
  }

  const canonicalSlug = counterpartyShortSlug(counterparty.id);
  if (routeParam !== canonicalSlug && routeParam !== counterparty.id) {
    redirect(`/${slug}/ic-transfer/suppliers/${canonicalSlug}`);
  }

  return <CounterpartyDetailsClient counterpartyId={counterparty.id} branchSlug={slug} />;
}
