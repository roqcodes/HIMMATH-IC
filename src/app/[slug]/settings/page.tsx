import { redirect } from 'next/navigation';
import { RESERVED_BRANCH_SLUGS } from '@/lib/asic/routing';

export default async function LegacySettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (RESERVED_BRANCH_SLUGS.has(slug)) redirect('/admin/global-settings');
  redirect(`/branch/${slug}/rates`);
}
