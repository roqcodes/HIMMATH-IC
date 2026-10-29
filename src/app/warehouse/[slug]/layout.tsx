import { SlugPortalLayout } from '@/components/asic/AsicPortalLayout';

export default function WarehousePortalLayout({ children }: { children: React.ReactNode }) {
  return <SlugPortalLayout portal="warehouse">{children}</SlugPortalLayout>;
}
