import { redirect } from 'next/navigation';

export default function LegacyBranchCustomersPage() {
  redirect('/admin/customers');
}
