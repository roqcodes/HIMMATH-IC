import AdminCustomerDetailPageClient from '@/components/customers/AdminCustomerDetailPageClient';
import { requirePortalUser } from '@/lib/asic/guards';

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  await requirePortalUser('admin');
  const { customerId } = await params;
  return <AdminCustomerDetailPageClient customerId={customerId} />;
}
