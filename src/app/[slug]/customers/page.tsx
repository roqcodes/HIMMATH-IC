import { redirect } from 'next/navigation';
import { counterpartyListPath } from '@/lib/counterparties/navigation';

export default async function LegacyBranchCustomersPage() {
  redirect(counterpartyListPath());
}
