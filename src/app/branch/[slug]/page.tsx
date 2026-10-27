import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { resolvePostLoginPath } from '@/lib/asic/postLogin.server';
import { RESERVED_BRANCH_SLUGS, normalizeAsicPath } from '@/lib/asic/routing';

/** Branch login landing — avoid redirect loop with requirePortalUser on /orders when unauthenticated. */
export default async function BranchIndexPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (RESERVED_BRANCH_SLUGS.has(slug)) {
    redirect(normalizeAsicPath(`/branch/${slug}/orders`));
  }
  const user = await getSessionUser(slug);
  if (user) {
    redirect(await resolvePostLoginPath(user.role, slug, user.branchId));
  }
  return null;
}
