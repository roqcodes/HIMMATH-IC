import { redirect } from 'next/navigation';
import ASICApp from '@/components/asic/ASICApp';
import { isAsicSection } from '@/lib/asic/nav';
import { requirePortalUser } from '@/lib/asic/guards';
import type { AsicSectionId } from '@/lib/asic/pages';

export default async function WarehouseSectionPage({
  params,
}: {
  params: Promise<{ slug: string; section: string }>;
}) {
  const { slug, section } = await params;
  await requirePortalUser('warehouse', slug);
  if (!isAsicSection(section)) redirect(`/warehouse/${slug}/orders`);
  return <ASICApp portal="warehouse" section={section as AsicSectionId} slug={slug} />;
}
