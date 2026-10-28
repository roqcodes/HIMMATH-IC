import { redirect } from 'next/navigation';
import ASICApp from '@/components/asic/ASICApp';
import { isAsicSection } from '@/lib/asic/nav';
import { requirePortalUser } from '@/lib/asic/guards';
import type { AsicSectionId } from '@/lib/asic/pages';

export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  await requirePortalUser('admin');
  const { section } = await params;
  if (section === 'customers' || section === 'accounts') redirect('/admin/entities');
  if (!isAsicSection(section)) redirect('/admin/dashboard');
  return <ASICApp portal="admin" section={section as AsicSectionId} />;
}
