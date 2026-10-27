import { notFound } from 'next/navigation';
import BranchDetailPageClient from '@/components/branches/BranchDetailPageClient';
import { getBranchBySlugAction } from '@/modules/admin/actions';
import { requirePortalUser } from '@/lib/asic/guards';

export default async function AdminBranchDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requirePortalUser('admin');
  const { slug } = await params;
  const res = await getBranchBySlugAction(slug);
  if (!res.success) notFound();

  return <BranchDetailPageClient slug={slug} />;
}
