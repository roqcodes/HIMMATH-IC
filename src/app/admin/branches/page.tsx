import AsicSectionPage from '@/components/asic/AsicSectionPage';
import { requirePortalUser } from '@/lib/asic/guards';

export default async function AdminBranchesPage() {
  await requirePortalUser('admin');
  return <AsicSectionPage portal="admin" section="branches" />;
}
