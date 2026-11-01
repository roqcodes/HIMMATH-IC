import { redirect, notFound } from 'next/navigation';
import CounterpartyDetailsClient from '@/components/counterparties/CounterpartyDetailsClient';
import { requirePortalUser } from '@/lib/asic/guards';
import { fetchCounterpartyByRouteParam } from '@/lib/counterparties/resolveCounterparty';
import { counterpartyShortSlug } from '@/lib/counterparties/counterpartySlug';

export default async function AdminCounterpartyDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePortalUser('admin');
  const { id: routeParam } = await params;

  const canManage = user.role === 'admin' || user.role === 'auditor';
  if (!canManage) {
    redirect('/admin/counterparties');
  }

  const counterparty = await fetchCounterpartyByRouteParam(routeParam);
  if (!counterparty) {
    notFound();
  }

  const canonicalSlug = counterpartyShortSlug(counterparty.id);
  if (routeParam !== canonicalSlug && routeParam !== counterparty.id) {
    redirect(`/admin/counterparties/${canonicalSlug}`);
  }

  return <CounterpartyDetailsClient counterpartyId={counterparty.id} />;
}
