import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';

/** HQ login landing — only redirect authenticated users; unauthenticated users see LoginPage via AppLayout. */
export default async function AdminIndexPage() {
  const user = await getSessionUser();
  if (user) redirect('/admin/dashboard');
  return null;
}
