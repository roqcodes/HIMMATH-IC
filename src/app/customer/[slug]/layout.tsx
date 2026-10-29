import { SlugPortalLayout } from '@/components/asic/AsicPortalLayout';

export default function CustomerPortalLayout({ children }: { children: React.ReactNode }) {
  return <SlugPortalLayout portal="customer">{children}</SlugPortalLayout>;
}
