import { redirect } from 'next/navigation';
import ASICApp from '@/components/asic/ASICApp';
import { isAsicSection } from '@/lib/asic/nav';
import { requirePortalUser } from '@/lib/asic/guards';
import type { AsicSectionId } from '@/lib/asic/pages';

export default async function CollectionSectionPage({
  params,
}: {
  params: Promise<{ slug: string; section: string }>;
}) {
  const { slug, section } = await params;
  await requirePortalUser('collection', slug);
  if (!isAsicSection(section)) redirect(`/collection/${slug}/fx-settlements`);
  return <ASICApp portal="collection" section={section as AsicSectionId} slug={slug} />;
}
