import { ICTransferFilterProvider } from '@/components/ic-transfer/shared/ICTransferFilterProvider';

export default function DeliveryPortalLayout({ children }: { children: React.ReactNode }) {
  return <ICTransferFilterProvider>{children}</ICTransferFilterProvider>;
}
