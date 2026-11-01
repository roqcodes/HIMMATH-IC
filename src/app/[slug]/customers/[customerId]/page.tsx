import { redirect } from 'next/navigation';
import { counterpartyListHighlightPath } from '@/lib/counterparties/navigation';

export default async function CustomerDetailRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; customerId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { slug, customerId } = await params;
  const { from } = await searchParams;
  redirect(counterpartyListHighlightPath(customerId, { from, branchSlug: slug }));
}
