import ASICApp from '@/components/asic/ASICApp';
import { requirePortalUser } from '@/lib/asic/guards';

export default async function AdminWarehousePage() {
  await requirePortalUser('admin');
  return <ASICApp portal="admin" section="warehouse" />;
}
