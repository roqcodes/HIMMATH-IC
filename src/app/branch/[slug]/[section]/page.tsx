import { redirect } from 'next/navigation';
import ASICApp from '@/components/asic/ASICApp';
import { isAsicSection } from '@/lib/asic/nav';
import { requirePortalUser } from '@/lib/asic/guards';
import { normalizeAsicPath, RESERVED_BRANCH_SLUGS } from '@/lib/asic/routing';
import type { AsicSectionId } from '@/lib/asic/pages';

export default async function BranchSectionPage({
  params,
}: {
  params: Promise<{ slug: string; section: string }>;
}) {
  const { slug, section } = await params;
  if (RESERVED_BRANCH_SLUGS.has(slug)) {
    redirect(normalizeAsicPath(`/branch/${slug}/${section}`));
  }
  await requirePortalUser('branch', slug);
  if (section === 'customers') redirect(`/branch/${slug}/accounts`);
  if (!isAsicSection(section)) redirect(`/branch/${slug}/orders`);
  return <ASICApp portal="branch" section={section as AsicSectionId} slug={slug} />;
}
