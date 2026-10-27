import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';

export default async function WarehousePortalPage(
  props: { params: Promise<{ slug: string }> },
) {
  const params = await props.params;
  const user = await getSessionUser(params.slug);
  if (!user) redirect('/');

  if (user.role?.startsWith('delivery')) {
    redirect(`/delivery/${params.slug}/settlement`);
  }

  redirect(`/warehouse/${params.slug}/orders`);
}
