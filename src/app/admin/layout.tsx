import { ICTransferFilterProvider } from '@/components/ic-transfer/shared/ICTransferFilterProvider';
import { AdminPortalLayout } from '@/components/asic/AsicPortalLayout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ICTransferFilterProvider>
      <AdminPortalLayout>{children}</AdminPortalLayout>
    </ICTransferFilterProvider>
  );
}
