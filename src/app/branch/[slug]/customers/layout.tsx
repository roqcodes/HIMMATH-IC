import CustomerDetailShell from '@/components/customers/CustomerDetailShell';

export default function BranchCustomerDetailLayout({ children }: { children: React.ReactNode }) {
  return <CustomerDetailShell>{children}</CustomerDetailShell>;
}
