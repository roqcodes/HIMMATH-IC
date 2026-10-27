import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { resolvePostLoginPath } from '@/lib/asic/postLogin.server';

export default async function LegacyBranchHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getSessionUser(slug);
  if (!user) return null;
  redirect(await resolvePostLoginPath(user.role, slug, user.branchId));
}
