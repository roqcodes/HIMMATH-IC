import { ICTransferFilterProvider } from '@/components/ic-transfer/shared/ICTransferFilterProvider';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <ICTransferFilterProvider>{children}</ICTransferFilterProvider>;
}
