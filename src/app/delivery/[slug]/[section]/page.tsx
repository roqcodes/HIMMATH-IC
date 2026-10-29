import { redirect } from 'next/navigation';
import AsicSectionPage from '@/components/asic/AsicSectionPage';
import { isAsicSection } from '@/lib/asic/nav';
import { requirePortalUser } from '@/lib/asic/guards';
import type { AsicSectionId } from '@/lib/asic/pages';

export default async function DeliverySectionPage({
  params,
}: {
  params: Promise<{ slug: string; section: string }>;
}) {
  const { slug, section } = await params;
  await requirePortalUser('delivery', slug);
  if (!isAsicSection(section)) redirect(`/delivery/${slug}/settlement`);
  return <AsicSectionPage portal="delivery" section={section as AsicSectionId} slug={slug} />;
}
