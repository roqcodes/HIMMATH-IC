import { redirect } from 'next/navigation';
import AsicSectionPage from '@/components/asic/AsicSectionPage';
import { isAsicSection } from '@/lib/asic/nav';
import { requirePortalUser } from '@/lib/asic/guards';
import type { AsicSectionId } from '@/lib/asic/pages';

export default async function CustomerSectionPage({
  params,
}: {
  params: Promise<{ slug: string; section: string }>;
}) {
  const { slug, section } = await params;
  await requirePortalUser('customer', slug);
  if (!isAsicSection(section)) redirect(`/customer/${slug}/orders`);
  return <AsicSectionPage portal="customer" section={section as AsicSectionId} slug={slug} />;
}
