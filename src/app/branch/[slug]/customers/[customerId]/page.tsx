import CustomerDetailPage from '@/components/customers/CustomerDetailPage';

export default async function BranchCustomerDetailRoute({
  params,
}: {
  params: Promise<{ slug: string; customerId: string }>;
}) {
  await params;
  return <CustomerDetailPage />;
}
