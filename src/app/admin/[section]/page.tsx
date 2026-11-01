import { redirect } from 'next/navigation';
import AsicSectionPage from '@/components/asic/AsicSectionPage';
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
  if (section === 'accounts') redirect('/admin/entities');
  if (section === 'customers' || section === 'suppliers') redirect('/admin/counterparties');
  if (!isAsicSection(section)) redirect('/admin/dashboard');
  return <AsicSectionPage portal="admin" section={section as AsicSectionId} />;
}
