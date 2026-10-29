import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { HQ_IC_FUNDS_BRANCH_SLUG } from '@/lib/icFunds/hqBranch';
import { RESERVED_BRANCH_SLUGS } from '@/lib/asic/routing';

export default async function CustomerDetailRoute({
  params,
}: {
  params: Promise<{ slug: string; customerId: string }>;
}) {
  const { slug, customerId } = await params;
  if (RESERVED_BRANCH_SLUGS.has(slug) || slug === HQ_IC_FUNDS_BRANCH_SLUG) {
    const user = await getSessionUser(slug === HQ_IC_FUNDS_BRANCH_SLUG ? undefined : slug);
    if (user?.role === 'admin' || user?.role === 'auditor' || user?.role === 'staff') {
      redirect(`/admin/customers/${customerId}`);
    }
  }
  const CustomerDetailPage = (await import('@/components/customers/CustomerDetailPage')).default;
  return <CustomerDetailPage />;
}
