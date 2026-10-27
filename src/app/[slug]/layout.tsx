import type { Metadata } from 'next';
import { PRODUCT_NAME } from '@/lib/brand';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  const branchName = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return {
    title: `${branchName} — ${PRODUCT_NAME}`,
    manifest: `/api/manifest/${slug}`,
  };
}

export default function BranchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
