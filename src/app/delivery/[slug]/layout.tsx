import { SlugPortalLayout } from '@/components/asic/AsicPortalLayout';

export default function DeliveryPortalLayout({ children }: { children: React.ReactNode }) {
  return <SlugPortalLayout portal="delivery">{children}</SlugPortalLayout>;
}
