import { getSessionUser } from '@/lib/auth';
import CounterpartiesPage from '@/components/counterparties/CounterpartiesPage';

export default async function SupplierManagementPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await getSessionUser((await params).slug);
  return <CounterpartiesPage />;
}
