import { redirect } from 'next/navigation';
import { requirePortalUser } from '@/lib/asic/guards';
import { counterpartyListHighlightPath } from '@/lib/counterparties/navigation';

export default async function AdminCustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  await requirePortalUser('admin');
  const { customerId } = await params;
  const { from } = await searchParams;
  redirect(counterpartyListHighlightPath(customerId, { from }));
}
