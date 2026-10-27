import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';

export default async function DeliveryIndexPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getSessionUser(slug);
  if (user) redirect(`/delivery/${slug}/settlement`);
  return null;
}
