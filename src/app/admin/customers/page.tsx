import AsicSectionPage from '@/components/asic/AsicSectionPage';
import { requirePortalUser } from '@/lib/asic/guards';

export default async function AdminCustomersPage() {
  await requirePortalUser('admin');
  return <AsicSectionPage portal="admin" section="customers" />;
}
