import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';

export default async function WarehouseIndexPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getSessionUser(slug);
  if (user) redirect(`/warehouse/${slug}/orders`);
  return null;
}
