import { ICTransferFilterProvider } from '@/components/ic-transfer/shared/ICTransferFilterProvider';

export default function WarehousePortalLayout({ children }: { children: React.ReactNode }) {
  return <ICTransferFilterProvider>{children}</ICTransferFilterProvider>;
}
