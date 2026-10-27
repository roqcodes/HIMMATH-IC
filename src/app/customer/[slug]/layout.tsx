import { ICTransferFilterProvider } from '@/components/ic-transfer/shared/ICTransferFilterProvider';

export default function CustomerPortalLayout({ children }: { children: React.ReactNode }) {
  return <ICTransferFilterProvider>{children}</ICTransferFilterProvider>;
}
