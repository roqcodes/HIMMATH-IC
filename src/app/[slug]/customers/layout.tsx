import CustomerDetailShell from '@/components/customers/CustomerDetailShell';

export default function LegacyCustomerDetailLayout({ children }: { children: React.ReactNode }) {
  return <CustomerDetailShell>{children}</CustomerDetailShell>;
}
