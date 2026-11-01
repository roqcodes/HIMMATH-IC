import { redirect } from 'next/navigation';
import { requirePortalUser } from '@/lib/asic/guards';

export default async function AdminCustomersPage() {
  await requirePortalUser('admin');
  redirect('/admin/counterparties');
}
